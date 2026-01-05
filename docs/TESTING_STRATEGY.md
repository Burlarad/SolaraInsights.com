# Solara Testing Strategy

**Version:** 1.0
**Date:** 2026-01-01

---

## Current Testing Setup

### Framework
- **Test Runner:** Vitest v2.1.8
- **DOM Environment:** jsdom v25.0.1
- **React Testing:** @testing-library/react v16.1.0
- **API Mocking:** msw v2.7.0 (Mock Service Worker)
- **Coverage:** @vitest/coverage-v8

### Configuration
```
vitest.config.ts
__tests__/setup.ts
```

### Running Tests
```bash
npm run test           # Run all tests once
npm run test:watch     # Watch mode
npm run test:ui        # Interactive UI
npm run test:coverage  # With coverage report
```

---

## Current Test Coverage

### Existing Test Files

| Directory | Test Files | Coverage Area |
|-----------|------------|---------------|
| `__tests__/api/` | 2 | insights, birth-chart routes |
| `__tests__/auth/` | 3 | session guards, profile creation, checkout cookie |
| `__tests__/infrastructure/` | 3 | redis failures, rate limiting, cost control |
| `__tests__/payments/` | 3 | claim session, stripe webhook, membership status |
| `__tests__/security/` | 1 | token encryption |
| `__tests__/validation/` | 1 | birth data validation |

### Total: 13 test files

---

## Testing Philosophy

### 1. Test Types by Priority

```
                    ┌─────────────────┐
                    │     E2E Tests   │  ← Cypress/Playwright (not implemented)
                   ┌┴─────────────────┴┐
                   │ Integration Tests │  ← API routes with mocked services
                  ┌┴───────────────────┴┐
                  │    Unit Tests       │  ← Pure functions, utilities
                 ┌┴─────────────────────┴┐
                 │     Type Safety       │  ← TypeScript compilation
                └───────────────────────┘
```

### 2. What to Test

| Must Test | Optional | Don't Test |
|-----------|----------|------------|
| Auth guards | UI components | External APIs directly |
| Payment flows | Edge cases | Framework behavior |
| AI cost control | Happy paths | Supabase/Stripe SDKs |
| Rate limiting | Error messages | Generated types |
| Token encryption | Translations | |
| Input validation | | |

---

## Test Categories & Standards

### Category 1: Security Tests

**Location:** `__tests__/security/`

**Required Coverage:**
- [ ] Token encryption/decryption
- [ ] PKCE code verifier generation
- [ ] OAuth state validation
- [ ] Open redirect prevention
- [ ] Service role key isolation

**Example Test Pattern:**
```typescript
describe("token-encryption", () => {
  it("encrypts and decrypts tokens correctly", async () => {
    const original = "secret-token-123";
    const encrypted = await encryptToken(original);
    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const token = "same-token";
    const encrypted1 = await encryptToken(token);
    const encrypted2 = await encryptToken(token);
    expect(encrypted1).not.toBe(encrypted2);
  });
});
```

### Category 2: Payment Tests

**Location:** `__tests__/payments/`

**Required Coverage:**
- [ ] Checkout session creation
- [ ] Webhook signature verification
- [ ] Session claiming logic
- [ ] Subscription status updates
- [ ] Plan resolution (individual vs family)

**Example Test Pattern:**
```typescript
describe("stripe-webhook", () => {
  it("updates profile on checkout.session.completed", async () => {
    const event = createMockStripeEvent("checkout.session.completed", {
      customer_email: "test@example.com",
      metadata: { plan: "individual" },
    });

    const response = await POST(createMockRequest({
      headers: { "stripe-signature": mockSignature },
      body: event,
    }));

    expect(response.status).toBe(200);
    // Verify profile was updated
  });
});
```

### Category 3: Auth Tests

**Location:** `__tests__/auth/`

**Required Coverage:**
- [ ] Session validation
- [ ] Profile creation on first login
- [ ] OAuth callback handling
- [ ] Reauth flow
- [ ] Protected route guards

**Example Test Pattern:**
```typescript
describe("session-guards", () => {
  it("redirects to sign-in when no session", async () => {
    mockSupabaseNoUser();

    const result = await renderProtectedPage();

    expect(result.redirect).toBe("/sign-in");
  });

  it("allows access when session valid and paid", async () => {
    mockSupabaseWithUser(createMockProfile({
      membership_plan: "individual",
      subscription_status: "active",
      is_onboarded: true,
    }));

    const result = await renderProtectedPage();

    expect(result.redirect).toBeUndefined();
  });
});
```

### Category 4: Infrastructure Tests

**Location:** `__tests__/infrastructure/`

**Required Coverage:**
- [ ] Redis connection failures (graceful degradation)
- [ ] Rate limiting logic
- [ ] Cost control circuit breaker
- [ ] Cache key generation
- [ ] Lock acquisition/release

**Example Test Pattern:**
```typescript
describe("cost-control", () => {
  it("blocks requests when budget exceeded", async () => {
    mockRedisGet("openai:budget:2025-01-01", 150); // Over $100 limit

    const result = await checkBudget();

    expect(result.allowed).toBe(false);
  });

  it("fails closed when Redis unavailable", async () => {
    mockRedisUnavailable();

    const result = await checkBudget();

    expect(result.allowed).toBe(false); // fail-closed default
  });
});
```

### Category 5: API Route Tests

**Location:** `__tests__/api/`

**Required Coverage:**
- [ ] Input validation
- [ ] Auth enforcement
- [ ] Rate limiting
- [ ] Cache behavior
- [ ] Error responses

---

## Missing Test Coverage (Priority Order)

### P0 - Critical (Add Immediately)

1. **Stripe Webhook Signature Verification**
   - Test that invalid signatures are rejected
   - Test replay attack protection

2. **Cost Control Budget Check**
   - Test budget exceeded behavior
   - Test fail-closed when Redis down

3. **Auth Callback Security**
   - Test open redirect prevention
   - Test reauth intent validation

### P1 - High Priority

4. **Social OAuth Flows**
   - Token refresh
   - Token decryption failures
   - Provider error handling

5. **Connection APIs**
   - CRUD operations
   - Space Between unlock logic
   - Mutual connection detection

6. **Numerology APIs**
   - Core number calculations
   - Lucky number generation

### P2 - Medium Priority

7. **Translation Loading**
   - Missing key fallback
   - RTL locale detection

8. **Journal APIs**
   - Create/read/delete
   - Export functionality

9. **Cron Job Endpoints**
   - Auth via CRON_SECRET
   - Rate limiting bypass

---

## Test Utilities

### Mock Factories

Located in `__tests__/setup.ts`:

```typescript
// Create mock user
const user = createMockUser({
  id: "uuid-1234",
  email: "test@example.com",
});

// Create mock profile
const profile = createMockProfile({
  membership_plan: "individual",
  subscription_status: "active",
});

// Create mock checkout session
const session = createMockCheckoutSession({
  metadata: { plan: "family" },
});

// Create mock request
const request = createMockRequest({
  method: "POST",
  body: { timeframe: "today" },
});
```

### Mocking Services

```typescript
// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile }),
    })),
  })),
}));

// Mock Redis
vi.mock("@/lib/cache/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(undefined),
}));

// Mock OpenAI
vi.mock("@/lib/openai/client", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(mockInsight) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      },
    },
  },
}));
```

---

## Test Naming Conventions

```typescript
describe("feature-name", () => {
  describe("method/function", () => {
    it("should [expected behavior] when [condition]", () => {
      // Arrange
      // Act
      // Assert
    });

    it("returns [value] for [input]", () => {});
    it("throws [error] when [condition]", () => {});
    it("calls [dependency] with [args]", () => {});
  });
});
```

---

## CI/CD Integration

### Recommended GitHub Actions Workflow

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
```

### Coverage Thresholds (Recommended)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
      exclude: [
        'node_modules/**',
        '__tests__/**',
        'types/**',
        '**/*.d.ts',
      ],
    },
  },
});
```

---

## Test Data Management

### Environment Variables

All test env vars are set in `__tests__/setup.ts`:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
process.env.STRIPE_SECRET_KEY = "sk_test_xxxx";
process.env.OPENAI_API_KEY = "sk-test-xxxx";
// etc.
```

### Database State

Tests should NOT hit real databases. Use mocks:

```typescript
// Good - mocked
vi.spyOn(supabase.from('profiles'), 'select')
  .mockResolvedValue({ data: mockProfile, error: null });

// Bad - real database
const { data } = await supabase.from('profiles').select('*');
```

---

## Running Specific Tests

```bash
# Run single file
npm test -- __tests__/payments/stripe-webhook.test.ts

# Run tests matching pattern
npm test -- --grep "checkout"

# Run with verbose output
npm test -- --reporter=verbose

# Update snapshots
npm test -- --update
```

---

*Testing strategy documentation for Solara Insights*
