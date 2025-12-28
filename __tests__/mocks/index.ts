/**
 * Mock Utilities for Solara Tests
 *
 * Provides mock implementations for external services:
 * - Redis (ioredis)
 * - Supabase
 * - Stripe
 * - OpenAI
 */

import { vi } from "vitest";

// =============================================================================
// REDIS MOCK
// =============================================================================

export interface MockRedisState {
  connected: boolean;
  data: Map<string, string>;
  errorOnNextOperation: boolean;
}

export function createMockRedis(initialState?: Partial<MockRedisState>) {
  const state: MockRedisState = {
    connected: initialState?.connected ?? true,
    data: initialState?.data ?? new Map(),
    errorOnNextOperation: initialState?.errorOnNextOperation ?? false,
  };

  const mockRedis = {
    // Connection state
    _state: state,

    // Simulate connection events
    on: vi.fn((event: string, callback: () => void) => {
      if (event === "connect" && state.connected) {
        callback();
      }
      if (event === "ready" && state.connected) {
        callback();
      }
      if (event === "error" && !state.connected) {
        callback();
      }
      return mockRedis;
    }),

    // Basic operations
    ping: vi.fn(async () => {
      if (!state.connected || state.errorOnNextOperation) {
        state.errorOnNextOperation = false;
        throw new Error("Redis connection failed");
      }
      return "PONG";
    }),

    get: vi.fn(async (key: string) => {
      if (!state.connected || state.errorOnNextOperation) {
        state.errorOnNextOperation = false;
        throw new Error("Redis connection failed");
      }
      return state.data.get(key) || null;
    }),

    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (!state.connected || state.errorOnNextOperation) {
        state.errorOnNextOperation = false;
        throw new Error("Redis connection failed");
      }
      // Handle SETNX (NX flag)
      if (args.includes("NX") && state.data.has(key)) {
        return null;
      }
      state.data.set(key, value);
      return "OK";
    }),

    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      if (!state.connected || state.errorOnNextOperation) {
        state.errorOnNextOperation = false;
        throw new Error("Redis connection failed");
      }
      state.data.set(key, value);
      return "OK";
    }),

    del: vi.fn(async (key: string) => {
      if (!state.connected || state.errorOnNextOperation) {
        state.errorOnNextOperation = false;
        throw new Error("Redis connection failed");
      }
      const existed = state.data.has(key);
      state.data.delete(key);
      return existed ? 1 : 0;
    }),

    incr: vi.fn(async (key: string) => {
      if (!state.connected || state.errorOnNextOperation) {
        state.errorOnNextOperation = false;
        throw new Error("Redis connection failed");
      }
      const current = parseInt(state.data.get(key) || "0", 10);
      const next = current + 1;
      state.data.set(key, next.toString());
      return next;
    }),

    ttl: vi.fn(async (key: string) => {
      if (!state.connected) {
        throw new Error("Redis connection failed");
      }
      return state.data.has(key) ? 3600 : -1;
    }),

    expire: vi.fn(async (_key: string, _seconds: number) => {
      if (!state.connected) {
        throw new Error("Redis connection failed");
      }
      return 1;
    }),

    // Multi/exec for transactions
    multi: vi.fn(() => {
      const commands: Array<() => Promise<unknown>> = [];
      return {
        incr: (key: string) => {
          commands.push(async () => {
            const current = parseInt(state.data.get(key) || "0", 10);
            const next = current + 1;
            state.data.set(key, next.toString());
            return [null, next];
          });
          return { incr: vi.fn(), ttl: vi.fn(), exec: vi.fn() };
        },
        ttl: (key: string) => {
          commands.push(async () => {
            return [null, state.data.has(key) ? 3600 : -1];
          });
          return { incr: vi.fn(), ttl: vi.fn(), exec: vi.fn() };
        },
        exec: vi.fn(async () => {
          if (!state.connected || state.errorOnNextOperation) {
            state.errorOnNextOperation = false;
            throw new Error("Redis connection failed");
          }
          return Promise.all(commands.map((cmd) => cmd()));
        }),
      };
    }),

    // Helper methods for tests
    _simulateDisconnect: () => {
      state.connected = false;
    },
    _simulateReconnect: () => {
      state.connected = true;
    },
    _setErrorOnNext: () => {
      state.errorOnNextOperation = true;
    },
    _clearData: () => {
      state.data.clear();
    },
  };

  return mockRedis;
}

// =============================================================================
// SUPABASE MOCK
// =============================================================================

export interface MockSupabaseState {
  user: unknown | null;
  profiles: Map<string, unknown>;
  sessionError: Error | null;
}

export function createMockSupabaseClient(initialState?: Partial<MockSupabaseState>) {
  const state: MockSupabaseState = {
    user: initialState?.user ?? null,
    profiles: initialState?.profiles ?? new Map(),
    sessionError: initialState?.sessionError ?? null,
  };

  return {
    _state: state,

    auth: {
      getUser: vi.fn(async () => {
        if (state.sessionError) {
          return { data: { user: null }, error: state.sessionError };
        }
        return { data: { user: state.user }, error: null };
      }),
      getSession: vi.fn(async () => {
        if (state.sessionError) {
          return { data: { session: null }, error: state.sessionError };
        }
        return {
          data: {
            session: state.user ? { user: state.user, access_token: "test-token" } : null,
          },
          error: null,
        };
      }),
      signOut: vi.fn(async () => {
        state.user = null;
        return { error: null };
      }),
      exchangeCodeForSession: vi.fn(async () => {
        return {
          data: { user: state.user, session: { access_token: "test-token" } },
          error: state.sessionError,
        };
      }),
      admin: {
        createUser: vi.fn(async (opts: { email: string }) => {
          const newUser = {
            id: `user-${Date.now()}`,
            email: opts.email,
            email_confirmed_at: new Date().toISOString(),
          };
          return { data: { user: newUser }, error: null };
        }),
        getUserById: vi.fn(async (id: string) => {
          return {
            data: { user: { id, email: "test@example.com" } },
            error: null,
          };
        }),
        generateLink: vi.fn(async () => {
          return {
            data: { properties: { hashed_token: "test-token-hash" } },
            error: null,
          };
        }),
        listUsers: vi.fn(async () => {
          return { data: { users: [] }, error: null };
        }),
      },
      verifyOtp: vi.fn(async () => {
        return { data: { user: state.user }, error: null };
      }),
    },

    from: vi.fn((table: string) => {
      const queryBuilder = {
        select: vi.fn(() => queryBuilder),
        insert: vi.fn(() => queryBuilder),
        update: vi.fn(() => queryBuilder),
        upsert: vi.fn(() => queryBuilder),
        delete: vi.fn(() => queryBuilder),
        eq: vi.fn(() => queryBuilder),
        ilike: vi.fn(() => queryBuilder),
        single: vi.fn(async () => {
          if (table === "profiles") {
            const profile = state.profiles.values().next().value;
            return { data: profile || null, error: profile ? null : { code: "PGRST116" } };
          }
          return { data: null, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "profiles") {
            const profile = state.profiles.values().next().value;
            return { data: profile || null, error: null };
          }
          return { data: null, error: null };
        }),
      };
      return queryBuilder;
    }),

    // Test helpers
    _setUser: (user: unknown) => {
      state.user = user;
    },
    _setProfile: (id: string, profile: unknown) => {
      state.profiles.set(id, profile);
    },
    _setSessionError: (error: Error | null) => {
      state.sessionError = error;
    },
  };
}

// =============================================================================
// STRIPE MOCK
// =============================================================================

export interface MockStripeState {
  sessions: Map<string, unknown>;
  subscriptions: Map<string, unknown>;
  webhookError: Error | null;
}

export function createMockStripe(initialState?: Partial<MockStripeState>) {
  const state: MockStripeState = {
    sessions: initialState?.sessions ?? new Map(),
    subscriptions: initialState?.subscriptions ?? new Map(),
    webhookError: initialState?.webhookError ?? null,
  };

  return {
    _state: state,

    checkout: {
      sessions: {
        retrieve: vi.fn(async (id: string) => {
          const session = state.sessions.get(id);
          if (!session) {
            throw new Error(`No such checkout session: ${id}`);
          }
          return session;
        }),
      },
    },

    subscriptions: {
      retrieve: vi.fn(async (id: string) => {
        const subscription = state.subscriptions.get(id);
        if (!subscription) {
          throw new Error(`No such subscription: ${id}`);
        }
        return subscription;
      }),
    },

    webhooks: {
      constructEvent: vi.fn((body: string, signature: string, secret: string) => {
        if (state.webhookError) {
          throw state.webhookError;
        }
        if (signature !== "valid-signature") {
          throw new Error("Invalid signature");
        }
        return JSON.parse(body);
      }),
    },

    // Test helpers
    _addSession: (id: string, session: unknown) => {
      state.sessions.set(id, session);
    },
    _addSubscription: (id: string, subscription: unknown) => {
      state.subscriptions.set(id, subscription);
    },
    _setWebhookError: (error: Error | null) => {
      state.webhookError = error;
    },
  };
}

// =============================================================================
// OPENAI MOCK
// =============================================================================

export interface MockOpenAIState {
  responses: string[];
  currentIndex: number;
  error: Error | null;
}

export function createMockOpenAI(initialState?: Partial<MockOpenAIState>) {
  const state: MockOpenAIState = {
    responses: initialState?.responses ?? ['{"test": "response"}'],
    currentIndex: initialState?.currentIndex ?? 0,
    error: initialState?.error ?? null,
  };

  return {
    _state: state,

    chat: {
      completions: {
        create: vi.fn(async () => {
          if (state.error) {
            throw state.error;
          }
          const response = state.responses[state.currentIndex] || state.responses[0];
          state.currentIndex = Math.min(state.currentIndex + 1, state.responses.length - 1);
          return {
            choices: [{ message: { content: response } }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
          };
        }),
      },
    },

    // Test helpers
    _addResponse: (response: string) => {
      state.responses.push(response);
    },
    _setError: (error: Error | null) => {
      state.error = error;
    },
    _reset: () => {
      state.currentIndex = 0;
    },
  };
}
