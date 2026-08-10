import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * SPEC-001 Task 1 — three projects so unit, DOM, and live-network contract
 * tests stay separable: `pnpm test:unit` never touches jsdom or the network,
 * and `pnpm test:contract` never runs as part of it.
 */
// Mirrors tsconfig.json's `@/*` path so test files (SPEC-002 onward) can use
// the same alias as app code. `process.cwd()` rather than `import.meta.url`,
// per SPEC-001 §8 deviation 2 — the one scheme Vitest's ESM runner and
// Playwright's CommonJS runner both agree on. Vitest's `projects` are each an
// independent Vite config, so this has to be repeated per project rather
// than set once at the root.
const alias = { "@": resolve(process.cwd(), "./src") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/support/**/*.test.ts"],
          exclude: ["src/**/*.dom.test.ts"],
          environment: "node",
          setupFiles: ["tests/support/setup-unit.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          include: ["src/**/*.dom.test.ts"],
          environment: "jsdom",
          setupFiles: ["tests/support/setup-unit.ts"],
        },
      },
      {
        resolve: { alias },
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
