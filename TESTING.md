# Testing Guide

## Quick Start

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
__tests__/
├── setup.ts                 # Global test setup (mocks, env vars)
├── mocks/
│   └── index.ts             # Mock utilities for external services
├── infrastructure/          # Phase 1: Critical infrastructure
│   ├── redis-failures.test.ts
│   ├── cost-control.test.ts
│   └── rate-limiting.test.ts
├── auth/                    # Phase 2: Authentication
│   ├── session-guards.test.ts
│   ├── checkout-cookie.test.ts
│   └── profile-creation.test.ts
├── payments/                # Phase 3: Payment system
│   ├── stripe-webhook.test.ts
│   ├── claim-session.test.ts
│   └── membership-status.test.ts
├── validation/              # Phase 4: Data validation
│   └── birth-data.test.ts
├── security/                # Phase 4: Security
│   └── token-encryption.test.ts
└── api/                     # Phase 5: API routes
    ├── insights.test.ts
    └── birth-chart.test.ts
```

## Test Phases

### Phase 1: Critical Infrastructure (Implemented)
Highest priority tests for systems that could cause outages:
- **Redis failures**: How the system behaves when Redis is down
- **Cost control**: Budget enforcement and fail modes
- **Rate limiting**: Request throttling and memory fallback

### Phase 2-5: Stub Tests (To Be Implemented)
Tests are stubbed with `test.todo()` for future implementation:
- Authentication flows
- Payment processing
- Data validation
- API routes

## Running Specific Tests

```bash
# Run a specific test file
npm test -- redis-failures

# Run tests matching a pattern
npm test -- --grep "Cost Control"

# Run only Phase 1 tests
npm test -- infrastructure/
```

## Coverage Thresholds

Current minimum thresholds (will increase over time):
- Statements: 20%
- Branches: 20%
- Functions: 20%
- Lines: 20%

## Mock Environment

Tests use these mock values (defined in `__tests__/setup.ts`):
- Supabase: `https://test-project.supabase.co`
- Stripe: `sk_test_xxxx`
- OpenAI: `sk-test-xxxx`
- Redis: `redis://localhost:6379`

No real external services are called during tests.

## Writing New Tests

1. Create test file in appropriate directory
2. Import test utilities from `@/__tests__/setup`
3. Import mocks from `@/__tests__/mocks`
4. Use descriptive test names that explain the scenario
5. Include both happy path and error cases

```typescript
import { describe, it, expect } from "vitest";
import { createMockProfile } from "@/__tests__/setup";

describe("Feature", () => {
  it("handles success case", () => {
    const profile = createMockProfile({ membership_plan: "individual" });
    // test logic
  });

  it("handles error case", () => {
    // error test
  });
});
```
