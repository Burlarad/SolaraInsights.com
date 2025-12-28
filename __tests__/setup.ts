/**
 * Vitest Test Setup
 *
 * This file runs before each test file. It sets up:
 * - Mock environment variables
 * - Global test utilities
 * - Mock service workers (when enabled)
 */

import { beforeAll, afterEach, afterAll, vi } from "vitest";

// =============================================================================
// MOCK ENVIRONMENT VARIABLES
// =============================================================================
// These are test-safe values that won't hit real services

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

process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw=="; // 32 bytes base64

process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";

// =============================================================================
// GLOBAL MOCKS
// =============================================================================

// Mock console.warn/error to reduce noise in tests (but keep for debugging)
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  // Suppress expected warnings during tests
  console.warn = (...args: unknown[]) => {
    const message = args[0]?.toString() || "";
    // Allow through important warnings, suppress expected ones
    if (
      !message.includes("[Cache]") &&
      !message.includes("[RateLimit]") &&
      !message.includes("[CostControl]")
    ) {
      originalWarn(...args);
    }
  };

  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() || "";
    // Suppress expected test errors
    if (
      !message.includes("[Cache]") &&
      !message.includes("[RateLimit]") &&
      !message.includes("[CostControl]") &&
      !message.includes("Redis")
    ) {
      originalError(...args);
    }
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Wait for a specified duration (useful for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock request object for API route testing
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Request {
  const { method = "GET", url = "http://localhost:3000", body, headers = {} } = options;

  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Create a mock Supabase user object
 */
export function createMockUser(overrides: Partial<{
  id: string;
  email: string;
  email_confirmed_at: string;
  user_metadata: Record<string, unknown>;
}> = {}) {
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

/**
 * Create a mock profile object
 */
export function createMockProfile(overrides: Partial<{
  id: string;
  email: string;
  membership_plan: string;
  subscription_status: string;
  is_onboarded: boolean;
  is_hibernated: boolean;
  birth_date: string;
  birth_time: string;
  birth_lat: number;
  birth_lon: number;
  timezone: string;
}> = {}) {
  return {
    id: overrides.id || "test-user-uuid-1234",
    email: overrides.email || "test@example.com",
    full_name: "Test User",
    preferred_name: "Test",
    membership_plan: overrides.membership_plan || "individual",
    subscription_status: overrides.subscription_status || "active",
    is_onboarded: overrides.is_onboarded ?? true,
    is_hibernated: overrides.is_hibernated ?? false,
    is_comped: false,
    role: "user",
    birth_date: overrides.birth_date || "1990-01-15",
    birth_time: overrides.birth_time || "14:30",
    birth_city: "New York",
    birth_region: "NY",
    birth_country: "USA",
    birth_lat: overrides.birth_lat ?? 40.7128,
    birth_lon: overrides.birth_lon ?? -74.006,
    timezone: overrides.timezone || "America/New_York",
    zodiac_sign: "Capricorn",
    language: "en",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    social_insights_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create a mock Stripe checkout session
 */
export function createMockCheckoutSession(overrides: Partial<{
  id: string;
  status: string;
  payment_status: string;
  customer_email: string;
  customer: string;
  subscription: string;
  metadata: Record<string, string>;
}> = {}) {
  return {
    id: overrides.id || "cs_test_session_123",
    status: overrides.status || "complete",
    payment_status: overrides.payment_status || "paid",
    mode: "subscription",
    customer_email: overrides.customer_email || "test@example.com",
    customer_details: {
      email: overrides.customer_email || "test@example.com",
    },
    customer: overrides.customer || "cus_test_123",
    subscription: overrides.subscription || "sub_test_123",
    metadata: overrides.metadata || { plan: "individual" },
    line_items: {
      data: [
        {
          price: {
            id: "price_individual_test",
          },
        },
      ],
    },
  };
}

// =============================================================================
// CLEANUP
// =============================================================================

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();

  // Reset module state if needed
  vi.resetModules();
});
