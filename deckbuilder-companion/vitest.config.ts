import { defineConfig } from "vitest/config";

/**
 * SPEC-001 Task 1 — three projects so unit, DOM, and live-network contract
 * tests stay separable: `pnpm test:unit` never touches jsdom or the network,
 * and `pnpm test:contract` never runs as part of it.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/**/*.dom.test.ts"],
          environment: "node",
          setupFiles: ["tests/support/setup-unit.ts"],
        },
      },
      {
        test: {
          name: "dom",
          include: ["src/**/*.dom.test.ts"],
          environment: "jsdom",
          setupFiles: ["tests/support/setup-unit.ts"],
        },
      },
      {
        test: {
          name: "contract",
          include: ["tests/contract/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/domain/**"],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
