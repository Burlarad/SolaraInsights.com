# Solara Testing Strategy

**Version:** 1.0
**Date:** 2026-01-01

---

## Current Test Infrastructure

### Framework
```
vitest: 2.1.8
@testing-library/react: 16.1.0
msw: 2.7.0 (Mock Service Worker)
@vitest/coverage-v8: 2.1.8
jsdom: 25.0.1
```
**Source:** `package.json:49-64`

### Configuration
- **Config file:** `vitest.config.ts`
- **Setup file:** `__tests__/setup.ts` (223 lines)

### Running Tests
```bash
npm run test           # vitest run
npm run test:watch     # vitest
npm run test:ui        # vitest --ui
npm run test:coverage  # vitest run --coverage
```
**Source:** `package.json:11-14`

---

## Current Test Coverage

### Existing Test Files (13 total)

```
__tests__/
├── setup.ts                              # 223 lines - Mock env + utilities
├── mocks/
├── api/
│   ├── insights.test.ts                  # Insights API tests
│   └── birth-chart.test.ts               # Birth chart API tests
├── auth/
│   ├── session-guards.test.ts            # Auth guard logic
│   ├── profile-creation.test.ts          # Profile creation on OAuth
│   └── checkout-cookie.test.ts           # Checkout session cookie
├── infrastructure/
│   ├── redis-failures.test.ts            # Redis graceful degradation
│   ├── rate-limiting.test.ts             # Rate limit logic
│   └── cost-control.test.ts              # Budget circuit breaker
├── payments/
│   ├── claim-session.test.ts             # Checkout session claiming
│   ├── stripe-webhook.test.ts            # Webhook handling
│   └── membership-status.test.ts         # Subscription status
├── security/
│   └── token-encryption.test.ts          # Social token crypto
└── validation/
    └── birth-data.test.ts                # Birth data validation
```

### Coverage by Area

| Area | Test Files | Covered Endpoints | Gap |
|------|------------|-------------------|-----|
| Auth | 3 | callback, guards, profile | Social OAuth callbacks |
| Payments | 3 | webhook, claim, status | - |
| Infrastructure | 3 | redis, rate limit, cost | - |
| API | 2 | insights, birth-chart | numerology, connections, social |
| Security | 1 | token encryption | - |
| Validation | 1 | birth data | - |

---

## Test Setup Details

**Source:** `__tests__/setup.ts:1-222`

### Mock Environment Variables
```typescript
// __tests__/setup.ts:17-36
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-xxxx";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-xxxx";

process.env.STRIPE_SECRET_KEY = "sk_test_xxxx";
process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_xxxx";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_xxxx";
process.env.STRIPE_PRICE_ID = "price_individual_test";
process.env.STRIPE_FAMILY_PRICE_ID = "price_family_test";

process.env.OPENAI_API_KEY = "sk-test-xxxx";
process.env.OPENAI_DAILY_BUDGET_USD = "100";
process.env.OPENAI_BUDGET_FAIL_MODE = "closed";

process.env.REDIS_URL = "redis://localhost:6379";
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";
```

### Mock Factories

**createMockUser:** `__tests__/setup.ts:114-129`
```typescript
export function createMockUser(overrides = {}) {
  return {
    id: overrides.id || "test-user-uuid-1234",
    email: overrides.email || "test@example.com",
    email_confirmed_at: overrides.email_confirmed_at || new Date().toISOString(),
    user_metadata: overrides.user_metadata || {},
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
}
```

**createMockProfile:** `__tests__/setup.ts:134-174`
```typescript
export function createMockProfile(overrides = {}) {
  return {
    id: overrides.id || "test-user-uuid-1234",
    email: overrides.email || "test@example.com",
    full_name: "Test User",
    preferred_name: "Test",
    membership_plan: overrides.membership_plan || "individual",
    subscription_status: overrides.subscription_status || "active",
    is_onboarded: overrides.is_onboarded ?? true,
    is_hibernated: overrides.is_hibernated ?? false,
    birth_date: overrides.birth_date || "1990-01-15",
    birth_time: overrides.birth_time || "14:30",
    timezone: overrides.timezone || "America/New_York",
    // ...
  };
}
```

**createMockCheckoutSession:** `__tests__/setup.ts:179-210`
```typescript
export function createMockCheckoutSession(overrides = {}) {
  return {
    id: overrides.id || "cs_test_session_123",
    status: overrides.status || "complete",
    payment_status: overrides.payment_status || "paid",
    mode: "subscription",
    customer_email: overrides.customer_email || "test@example.com",
    metadata: overrides.metadata || { plan: "individual" },
    line_items: {
      data: [{ price: { id: "price_individual_test" } }],
    },
  };
}
```

---

## Missing Test Coverage

### P0 - Critical (Security/Payment)

| Area | Missing Test | File to Create | Evidence |
|------|--------------|----------------|----------|
| Stripe | Webhook signature rejection | `__tests__/payments/webhook-security.test.ts` | `app/api/stripe/webhook/route.ts:106-120` |
| Redis | Fail-closed for AI routes | `__tests__/infrastructure/redis-failclosed.test.ts` | `lib/cache/redis.ts:221-240` |
| Auth | Open redirect prevention | `__tests__/auth/callback-security.test.ts` | `app/auth/callback/route.ts:220-238` |

### P1 - High Priority

| Area | Missing Test | File to Create | Evidence |
|------|--------------|----------------|----------|
| Social | OAuth token refresh | `__tests__/social/oauth-refresh.test.ts` | `lib/oauth/providers/*.ts` |
| Social | Token decryption failure | `__tests__/social/crypto-failures.test.ts` | `lib/social/crypto.ts:66-83` |
| Connections | CRUD operations | `__tests__/api/connections.test.ts` | `app/api/connections/route.ts` |
| Connections | Space Between unlock | `__tests__/api/space-between.test.ts` | `app/api/connection-space-between/route.ts` |
| Numerology | Core calculations | `__tests__/api/numerology.test.ts` | `app/api/numerology/route.ts` |

### P2 - Medium Priority

| Area | Missing Test | Evidence |
|------|--------------|----------|
| Translations | Missing key fallback | `i18n.ts`, `messages/*.json` |
| Journal | CRUD + export | `app/api/journal/*.ts` |
| Cron | CRON_SECRET auth | `app/api/cron/*/route.ts` |
| Public APIs | Rate limiting | `app/api/public-*/route.ts` |

---

## Test Patterns to Follow

### API Route Test Pattern
```typescript
// Example: __tests__/api/insights.test.ts pattern
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/insights/route";
import { createMockRequest, createMockUser, createMockProfile } from "../setup";

describe("POST /api/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      // Mock Supabase to return no user
      vi.mock("@/lib/supabase/server", () => ({
        createServerSupabaseClient: vi.fn(() => ({
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        })),
      }));

      const request = createMockRequest({
        method: "POST",
        body: { timeframe: "today" },
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      // Mock rate limit exceeded
      vi.mock("@/lib/cache/rateLimit", () => ({
        checkRateLimit: vi.fn().mockResolvedValue({ success: false, resetAt: Date.now() + 60000 }),
      }));

      // ... test implementation
    });
  });
});
```

### Security Test Pattern
```typescript
// Example: __tests__/security/token-encryption.test.ts pattern
import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "@/lib/social/crypto";

describe("token encryption", () => {
  it("encrypts and decrypts correctly", () => {
    const original = "secret-oauth-token-12345";
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);

    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const token = "same-token";
    const encrypted1 = encryptToken(token);
    const encrypted2 = encryptToken(token);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptToken("test");
    const tampered = encrypted.slice(0, -4) + "XXXX";

    expect(() => decryptToken(tampered)).toThrow();
  });
});
```

### Infrastructure Test Pattern
```typescript
// Example: __tests__/infrastructure/cost-control.test.ts pattern
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkBudget, incrementBudget } from "@/lib/ai/costControl";

describe("cost control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_DAILY_BUDGET_USD = "100";
    process.env.OPENAI_BUDGET_FAIL_MODE = "closed";
  });

  describe("checkBudget", () => {
    it("allows request when under budget", async () => {
      vi.mock("@/lib/cache/redis", () => ({
        getCache: vi.fn().mockResolvedValue(50), // $50 used of $100
      }));

      const result = await checkBudget();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
    });

    it("blocks request when over budget", async () => {
      vi.mock("@/lib/cache/redis", () => ({
        getCache: vi.fn().mockResolvedValue(150), // $150 used of $100
      }));

      const result = await checkBudget();
      expect(result.allowed).toBe(false);
    });

    it("fails closed when Redis unavailable", async () => {
      vi.mock("@/lib/cache/redis", () => ({
        getCache: vi.fn().mockRejectedValue(new Error("Redis down")),
      }));

      const result = await checkBudget();
      expect(result.allowed).toBe(false); // fail-closed
    });
  });
});
```

---

## Mocking Guidelines

### Mocking Supabase
```typescript
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
  createAdminSupabaseClient: vi.fn(() => ({
    // Same structure with admin capabilities
  })),
}));
```

### Mocking Redis
```typescript
vi.mock("@/lib/cache/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  acquireLock: vi.fn().mockResolvedValue(true),
  acquireLockFailClosed: vi.fn().mockResolvedValue({ acquired: true, redisDown: false }),
  releaseLock: vi.fn().mockResolvedValue(undefined),
  isRedisAvailable: vi.fn().mockReturnValue(true),
}));
```

### Mocking Stripe
```typescript
vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(mockEvent),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue(mockSession),
        retrieve: vi.fn().mockResolvedValue(mockSession),
      },
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue(mockSubscription),
    },
  },
  STRIPE_CONFIG: {
    webhookSecret: "whsec_test",
    priceIds: { sanctuary: "price_test", family: "price_family_test" },
  },
}));
```

### Mocking OpenAI
```typescript
vi.mock("@/lib/openai/client", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(mockInsight) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      },
    },
  },
  OPENAI_MODELS: {
    dailyInsights: "gpt-4o-mini",
    yearlyInsights: "gpt-4o",
  },
}));
```

---

## CI/CD Integration

### Recommended GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
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
      - run: npm run lint
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
```

### Coverage Thresholds (Recommended)

Add to `vitest.config.ts`:
```typescript
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
        'components/**', // UI components - consider snapshot testing
      ],
    },
  },
});
```

---

## Test Commands Reference

```bash
# Run all tests
npm run test

# Run specific test file
npm test -- __tests__/payments/stripe-webhook.test.ts

# Run tests matching pattern
npm test -- --grep "budget"

# Run with verbose output
npm test -- --reporter=verbose

# Run with coverage
npm run test:coverage

# Interactive UI
npm run test:ui
```

---

*Testing strategy documentation for Solara Insights*
