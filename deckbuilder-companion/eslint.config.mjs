import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

/**
 * SPEC-000 Task 6 — the domain purity rule, enforced as lint rather than as a
 * code-review convention.
 *
 * `src/domain/**` may not import React, Next, the DOM, or any network client.
 * That single constraint is what keeps the domain unit-testable at millisecond
 * speed (SPEC-001) and what makes the v2 server migration additive rather than a
 * rewrite (requirements §10.3).
 *
 * Note `features` may NOT import `adapters` directly — all adapter access goes
 * through `state`. That keeps the "swap the Scryfall client for a server proxy"
 * change confined to one layer.
 */
/**
 * Modules `src/domain/**` may never import. This is the concrete expression of
 * NFR-6.2: the domain must stay renderer- and transport-free so it can be unit
 * tested in a plain node environment and reused verbatim by a v2 server.
 */
const DOMAIN_FORBIDDEN_MODULES = [
  "react",
  "react-dom",
  "react/**",
  "react-dom/**",
  "next",
  "next/**",
  "zustand",
  "zustand/**",
  "@dnd-kit/**",
  "@react-pdf/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**/*", partialMatch: false },
        { type: "features", pattern: "src/features/**/*", partialMatch: false },
        { type: "components", pattern: "src/components/**/*", partialMatch: false },
        { type: "state", pattern: "src/state/**/*", partialMatch: false },
        { type: "adapters", pattern: "src/adapters/**/*", partialMatch: false },
        { type: "domain", pattern: "src/domain/**/*", partialMatch: false },
      ],
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          // Without this the rule only inspects LOCAL imports, and the purity
          // rule below silently never fires. Verified by the probe in
          // `pnpm lint:purity-check`.
          checkAllOrigins: true,
          policies: [
            // Third-party and node core packages are allowed everywhere by
            // default; the domain carve-out is the last policy in this list.
            { allow: { to: { module: { origin: "external" } } } },
            { allow: { to: { module: { origin: "core" } } } },
            // Layer policy. Every element may import within itself; the
            // cross-layer arrows below are the architecture.
            {
              from: { element: { type: "domain" } },
              allow: { to: { element: { type: "domain" } } },
            },
            {
              from: { element: { type: "adapters" } },
              allow: { to: { element: { types: { anyOf: ["domain", "adapters"] } } } },
            },
            {
              from: { element: { type: "state" } },
              allow: { to: { element: { types: { anyOf: ["domain", "adapters", "state"] } } } },
            },
            {
              from: { element: { type: "features" } },
              allow: {
                to: {
                  element: { types: { anyOf: ["domain", "state", "features", "components"] } },
                },
              },
            },
            {
              from: { element: { type: "components" } },
              allow: { to: { element: { type: "components" } } },
            },
            {
              from: { element: { type: "app" } },
              allow: {
                to: { element: { types: { anyOf: ["app", "features", "components", "state"] } } },
              },
            },
            // The purity rule: no UI or transport libraries inside the domain.
            // One policy per module — `source` takes a single micromatch
            // pattern, not a list.
            ...DOMAIN_FORBIDDEN_MODULES.map((source) => ({
              from: { element: { type: "domain" } },
              disallow: { to: { module: { origin: "external", source } } },
            })),
          ],
        },
      ],
    },
  },

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test and coverage output.
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
