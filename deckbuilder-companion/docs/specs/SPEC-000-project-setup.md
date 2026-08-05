# SPEC-000 — Project Setup & Tooling

| | |
|---|---|
| **Depends on** | — |
| **Blocks** | Everything |
| **Requirements** | D-1, NFR-6.1, NFR-6.5, NFR-6.6, NFR-3.4, NFR-5.5, NFR-7.2 |
| **Estimated size** | Half a session |

---

## 1. Goal

A Next.js + TypeScript workspace that boots, type-checks, lints, builds, and enforces the domain purity rule in CI — before a single feature exists. Nothing here is a feature; everything here is the ground the features stand on.

## 2. Out of scope

Any UI beyond a placeholder page. Any domain code (that's SPEC-002). Test runners are configured in SPEC-001, not here.

---

## 3. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15+, App Router | D-1. Client-only in v1; server routes available for v2 without a rewrite. |
| Language | TypeScript, `strict: true` | NFR-6.1 |
| Package manager | pnpm | Fast, strict about phantom dependencies — which matters for the purity rule. |
| Styling | Tailwind CSS | Fast iteration; `prefers-color-scheme` dark mode is one class (NFR-3.4). |
| Components | shadcn/ui | Radix-based, accessible by default, copied into the repo rather than a dependency — so we can audit and adapt it. Directly supports NFR-2. |
| State | Zustand (+ `zundo` for undo/redo) | Tiny, framework-light, testable outside React. Undo/redo (FR-8.9) is a middleware rather than a rewrite. |
| Runtime validation | Zod | NFR-6.6 — validates Scryfall responses and imported workspace JSON. |
| Drag and drop | `@dnd-kit/core` | FR-8.8. Has a real keyboard sensor and live-region announcements. |
| PDF | `@react-pdf/renderer` | FR-10.5–10.8. Programmatic pagination control; `wrap={false}` gives FR-10.6 directly. Lazy-loaded (NFR-1.5). |
| Markdown rendering | `react-markdown` + `rehype-sanitize` | FR-6.6 game plan preview, with sanitisation for NFR-5.3. |
| Lint | ESLint + `eslint-plugin-boundaries` | The purity rule is a lint rule, not a code review convention. |
| Format | Prettier | |

**Rejected:** `react-dnd` (weaker a11y story than dnd-kit); `jsPDF` (too low-level for the pagination requirements); Redux Toolkit (ceremony not justified at this size); `window.print()` for PDF (no file download, no pagination control, untestable).

---

## 4. Tasks

### Task 1 — Scaffold the app

```bash
pnpm create next-app@latest deckbuilder-companion \
  --typescript --tailwind --eslint --app --src-dir --use-pnpm
```

Then set in `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`noUncheckedIndexedAccess` is not optional. Plan arithmetic indexes into arrays and maps constantly; this flag is what turns a whole class of "quantity is undefined" bugs into compile errors.

**Verify:** `pnpm typecheck` passes on the untouched scaffold.

---

### Task 2 — Directory skeleton

Create the tree from `README.md` §Conventions, each leaf holding a `.gitkeep` or an `index.ts` barrel. Do this now so that later specs never have to think about where a file goes.

---

### Task 3 — Scripts

`package.json`:

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "format": "prettier --write .",
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:contract": "vitest run --project contract",
    "test": "pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:e2e",
    "fixtures:refresh": "tsx scripts/refresh-scryfall-fixtures.ts"
  }
}
```

---

### Task 4 — Base layout, theming, attribution

1. Root layout with a header (app name, deck name once loaded) and a footer.
2. The footer carries the **Fan Content Policy disclaimer and Scryfall attribution** — NFR-7.1, NFR-7.2. It is a legal requirement, not a nicety; put it in now so it can never be forgotten later.
3. Dark mode via Tailwind's `media` strategy so it follows the system by default (NFR-3.4).
4. `prefers-reduced-motion` respected globally in `globals.css` (NFR-2.7):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### Task 5 — Content Security Policy

`next.config.ts` headers (NFR-5.5):

| Directive | Value |
|---|---|
| `default-src` | `'self'` |
| `img-src` | `'self' data: blob: https://cards.scryfall.io` |
| `connect-src` | `'self' https://api.scryfall.com` |
| `frame-ancestors` | `'none'` |

**Note:** `blob:` on `img-src` is needed for the PDF preview. If a later change makes Scryfall image hosts vary, update this — a missing CSP entry presents as silently broken images, which is a confusing failure mode. Add a comment in the config saying so.

---

### Task 6 — Enforce the domain purity rule ⭐

This is the highest-value task in this spec. The layer policy:

| From | May import |
|---|---|
| `domain` | `domain` only |
| `adapters` | `domain`, `adapters` |
| `state` | `domain`, `adapters`, `state` |
| `features` | `domain`, `state`, `features`, `components` |
| `components` | `components` |
| `app` | `app`, `features`, `components`, `state` |

Plus: `src/domain/**` may not import `react`, `react-dom`, `next`, `zustand`, `@dnd-kit/*` or `@react-pdf/*` as external modules.

Note that `features` cannot import `adapters` directly — all adapter access goes through `state`. That keeps the swap in requirements §10.3 (client Scryfall client → server proxy) to a single layer.

**Implemented in `eslint.config.mjs`.** Three traps cost real time here; if you are re-deriving this config, read these first:

1. **`eslint-plugin-boundaries` v7 renamed the API.** `boundaries/element-types` + `boundaries/external` are deprecated in favour of a single `boundaries/dependencies` rule taking `policies` (not `rules`) with object selectors (`{ from: { element: { type: "domain" } }, allow: { to: { element: { type: "domain" } } } }`). The old form still works but emits deprecation warnings on every run.
2. **`boundaries/dependencies` inspects only *local* imports unless `checkAllOrigins: true` is set.** Without it the entire external-module half of the purity rule silently never fires — lint just goes green. This is the most dangerous of the three because it looks like it works.
3. **`origin` and `source` selectors take a single micromatch string, not `{ anyOf: [...] }`.** Passing a list makes the matcher throw internally; the plugin logs a warning to stderr and skips the policy. Generate one policy per forbidden module instead.

Element patterns use `pattern: "src/<layer>/**/*"` with `partialMatch: false` so that files nested any depth inside a layer are matched (`mode: "full"` is the deprecated spelling of the same thing).

**Verify — and keep verifying:** `scripts/check-domain-purity.mjs`, exposed as `pnpm lint:purity` and run in CI. It writes a probe file violating both halves of the rule, asserts ESLint reports both, and deletes the probe. Traps 2 and 3 above are each invisible in a normal lint run, so a one-off manual check at setup time is not enough — an unverified guard rail is not a guard rail, and this one can silently stop being a guard rail later.

---

### Task 7 — CI

`.github/workflows/ci.yml`, on push and PR:

```
setup (pnpm, node 22, cache)
 ├─ typecheck
 ├─ lint
 ├─ test:unit  ──▶ upload coverage
 └─ build      ──▶ test:e2e (playwright, sharded)
```

Rules:
- Unit tests and E2E are separate jobs; unit failures must not be masked by a slow E2E job.
- E2E uploads the Playwright HTML report and traces on failure as artifacts.
- Coverage thresholds are set in SPEC-001 and enforced here.
- `test:contract` (live Scryfall) runs on a nightly schedule **only** — never on PRs. See SPEC-001 §6.

---

### Task 8 — `CLAUDE.md` / contributor notes

A short repo-root file stating: the purity rule, the TDD cycle, where specs live, and how to run tests. This is what a future session reads first.

---

## 5. Definition of Done

- [x] `pnpm dev` serves a page with header, footer, and the legal disclaimer.
- [x] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm build` all pass.
- [x] A React import inside `src/domain/` fails lint — verified repeatably by `pnpm lint:purity`.
- [x] CI runs typecheck, lint, format, purity and build. Unit and E2E jobs are deliberately absent until SPEC-001 rather than present-and-skipped, so CI never reports green for tests that do not exist.
- [x] Dark mode follows the OS setting.
- [x] CSP headers present in the response (verified with `curl -I` against the production build).

## 6. Deviations from this spec as written

Recorded so later specs stay consistent with what actually exists.

| # | Spec said | Reality | Why |
|---|---|---|---|
| 1 | `lint: "next lint"` | `lint: "eslint ."` | `next lint` was removed in Next 16. |
| 2 | `boundaries/element-types` + `boundaries/external` | single `boundaries/dependencies` with `policies` | v7 API; see the three traps in Task 6. |
| 3 | Verify the purity rule manually once | `scripts/check-domain-purity.mjs`, in CI | Two of the three traps are invisible in a passing lint run. |
| 4 | Footer in `src/components/ui/` | `src/features/legal/LegalFooter.tsx` | The attribution text is shared with the exporters (FR-10.13, NFR-7.5), so it lives in `src/domain/export/attribution.ts` — and `components` may not import `domain`. `features` may. |
| 5 | — | Root layout types `children` explicitly rather than using Next's generated `LayoutProps` global | Keeps `tsc --noEmit` from depending on `.next/types`, so the CI typecheck job does not need a prior build. |
| 6 | — | Added `format:check` to CI | NFR-6.5 requires formatting enforced in CI, not just lint. |
| 7 | Full stack table | Only `eslint-plugin-boundaries`, `prettier`, `eslint-import-resolver-typescript` installed | Zustand, dnd-kit, Zod, `@react-pdf/renderer` and the test runners are installed by the specs that first use them, so the dependency list stays honest about what is actually wired up. |
| 8 | `.github/workflows/ci.yml` | at the **repo root**, with `working-directory: deckbuilder-companion` | The app is a subfolder of the `mtg-utils` repo. |
