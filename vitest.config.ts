import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for React component tests
    environment: "jsdom",

    // Setup file runs before each test file
    setupFiles: ["./__tests__/setup.ts"],

    // Include test files
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],

    // Exclude node_modules and build output
    exclude: ["node_modules", ".next", "out"],

    // Global test utilities (describe, it, expect)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/**/*.ts",
        "app/api/**/*.ts",
        "providers/**/*.tsx",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "__tests__/**",
      ],
      // Minimum coverage thresholds
      // Currently at 3% while we implement test stubs (Phase 2-5)
      // Increase as more tests are implemented
      thresholds: {
        statements: 3,
        branches: 3,
        functions: 3,
        lines: 3,
      },
    },

    // Timeout for slow tests (Redis, etc.)
    testTimeout: 10000,

    // Pool options for faster tests
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
