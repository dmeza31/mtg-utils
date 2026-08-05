# SPEC-001 — Testing Strategy & TDD Workflow

| | |
|---|---|
| **Depends on** | SPEC-000 |
| **Blocks** | Everything |
| **Requirements** | NFR-6.2, NFR-6.3, NFR-6.5, NFR-2.x |
| **Estimated size** | One session |

---

## 1. Goal

Establish the test infrastructure and the TDD cycle **before** any feature code, so that every subsequent spec can say "write this test first" and mean it literally.

---

## 2. Why two runners

You asked about Playwright, and Playwright is the right tool for the user-story suite — but not for the whole pyramid.

| | Vitest | Playwright |
|---|---|---|
| Feedback loop | ~5–50 ms per test | ~1–5 s per test |
| Best at | Pure functions, edge cases, exhaustive input tables | Real browser behaviour, real user journeys |
| Used for | `src/domain/**`, adapters, store logic | One spec per user story, plus DnD component tests |

The decklist parser alone will have 60+ cases (every variant in FR-1.7 × malformed inputs). At Playwright speeds that's a suite you run at the end; at Vitest speeds it's a suite you run on every keystroke. **TDD only works if the inner loop is fast enough that you don't skip it.** Playwright is not a worse tool here — it's a tool for a different layer, and it owns that layer completely.

### The split

```
        ╱ ─────────────────────────╲     Playwright E2E — 1 spec per user story (19 specs)
       ╱   Journey / story tests    ╲    Real browser, mocked network, real interactions
      ╱───────────────────────────────╲
     ╱  Playwright Component Tests     ╲ Drag-and-drop only (FR-8) — real pointer + keyboard
    ╱───────────────────────────────────╲
   ╱   Vitest — adapters & store         ╲ Scryfall client, cache, storage, Zustand actions
  ╱───────────────────────────────────────╲
 ╱   Vitest — domain (the bulk of tests)   ╲ Parser, validation, plan arithmetic, exporters
╱───────────────────────────────────────────╲
```

**Coverage targets** (enforced in CI): `src/domain/**` ≥ 90% lines & branches (NFR-6.3). Everything else: no threshold — coverage on UI code measures the wrong thing. The E2E suite is what covers the UI, and its completeness is measured by story traceability (§7), not by percentage.

---

## 3. The TDD cycle

Every task in every spec follows this. It is not a suggestion.

```
1. RED       Write one failing test naming the requirement ID.
             Run it. Watch it fail for the RIGHT reason
             (assertion failure, not import error).

2. GREEN     Write the least code that passes. Hardcoding is
             legitimate here — the next test removes it.

3. REFACTOR  Clean up with tests green. Extract, rename, dedupe.
             No behaviour change.

4. COMMIT    One commit per green cycle where practical.
             Message references the requirement ID.
```

**Outside-in for features:** start each story with its Playwright E2E test. It will fail (nothing exists). Let that failure drive you inward to the domain unit tests. When the domain is green, come back out and wire the UI until the E2E goes green. The E2E test is the definition of the story; the unit tests are the definition of the logic.

**On hardcoding:** the discipline that makes step 2 safe is that you only remove a hardcoded value when a *second* test forces you to. If you can't think of a second test, the hardcoded value may genuinely be the specification.

---

## 4. Tasks

### Task 1 — Vitest

`vitest.config.ts`, using projects so unit and contract tests are separable:

```ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          environment: 'node',          // domain is pure — no jsdom needed
          setupFiles: ['tests/support/setup-unit.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          include: ['src/**/*.dom.test.ts'],
          environment: 'jsdom',         // only for storage/localStorage adapters
        },
      },
      {
        test: {
          name: 'contract',
          include: ['tests/contract/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
})
```

Domain tests run in `node`, not `jsdom`. That is deliberate: if a domain test ever *needs* jsdom, the purity rule has been broken and the test failing loudly is the correct outcome.

**RED first:** write `src/domain/__smoke__.test.ts` asserting `1 + 1 === 3`, confirm it fails, fix it to `2`, confirm it passes. Verify the harness before trusting it.

---

### Task 2 — Playwright

`playwright.config.ts`:

```ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile',   use: { ...devices['iPhone 14'] } },
    { name: 'tablet',   use: { ...devices['iPad Pro 11'] } },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

Project usage rules, so the matrix doesn't become 19 × 5 = 95 slow tests:
- **chromium** runs every story spec.
- **firefox / webkit** run a tagged `@cross-browser` subset: import, plan edit, export.
- **mobile** runs specs tagged `@mobile` — B1, B3 (readable at 320px, NFR-3.2), D2 (list mode is the mobile path, FR-9.7), E3.
- **tablet** runs D1 only — touch drag-and-drop (FR-8.7).

Test against the **production build**, not `next dev`. Dev-mode timing and bundle behaviour differ enough to hide real problems.

---

### Task 3 — Fixtures ⭐

One fixture set, shared by Vitest and Playwright. Two sources of truth for card data would guarantee drift.

```
tests/fixtures/
├── decklists/
│   ├── mtgo-blankline.txt          # canonical MTGO export, blank-line sideboard
│   ├── header-sideboard.txt        # Deck / Sideboard headers
│   ├── workstation-sb-prefix.txt   # SB: prefixed lines
│   ├── arena-setcodes.txt          # 4 Lightning Bolt (2XM) 129
│   ├── quantity-x.txt              # 4x Lightning Bolt
│   ├── dfc-and-split.txt           # Fire // Ice, Delver of Secrets, adventures
│   ├── accented.txt                # Lim-Dûl's Vault, Æther Vial, Nazgûl
│   ├── malformed.txt               # missing quantities, junk lines, comments
│   ├── undersized.txt              # 58 maindeck, 16 sideboard → FR-4.1, FR-4.2
│   ├── unresolvable.txt            # "Lightnin Bolt" → FR-2.10 did-you-mean
│   └── modern-izzet-murktide.txt   # realistic full 75, the happy-path fixture
├── scryfall/
│   ├── collection-*.json           # POST /cards/collection responses
│   ├── search-prints-*.json        # oldest-print search responses
│   └── named-fuzzy-*.json          # did-you-mean responses
├── images/
│   └── card-placeholder.png        # 1×1 PNG served for every card image request
└── workspaces/
    ├── valid-v1.json               # FR-11.2 import
    ├── corrupt.json                # NFR-4.4
    └── future-version.json         # FR-11.3 migration path
```

**`scripts/refresh-scryfall-fixtures.ts`** regenerates the `scryfall/` fixtures from the live API (`pnpm fixtures:refresh`). Run it deliberately, review the diff, commit it. Fixtures are checked in; tests never hit the network.

Prefer the realistic 75-card fixture as the default for E2E. Tests built on a 4-card toy deck stop resembling the product and stop catching layout and performance problems.

---

### Task 4 — Scryfall mocking

**Unit layer — MSW (`tests/support/scryfall-mock.ts`):**

```ts
export const scryfallHandlers = [
  http.post('https://api.scryfall.com/cards/collection', async ({ request }) => { /* fixture by name set */ }),
  http.get('https://api.scryfall.com/cards/search', ({ request }) => { /* fixture by q param */ }),
  http.get('https://api.scryfall.com/cards/named', ({ request }) => { /* fuzzy fixture */ }),
]
```

**E2E layer — Playwright route interception (`tests/support/fixtures.ts`):**

```ts
export const test = base.extend<{ scryfall: ScryfallMock }>({
  scryfall: async ({ page }, use) => {
    const mock = new ScryfallMock(page)     // reads the SAME tests/fixtures/scryfall files
    await mock.install()
    await use(mock)
  },
})
```

`ScryfallMock` must support, because specs A and B need them:
- `mock.fail('collection')` — force a 500 → FR-2.11, NFR-4.2
- `mock.rateLimit()` — force a 429 → FR-2.3, FR-2.11
- `mock.delay(ms)` — slow response → loading-state assertions
- `mock.offline()` — abort all Scryfall routes → FR-10.12, NFR-4.1
- `mock.requestCount(endpoint)` — assert batching and cache behaviour → **FR-2.2, FR-2.6, FR-2.15**

That last one matters more than it looks. FR-2.6 ("a cache hit SHALL NOT produce a network request") is only testable by counting requests; without this helper it silently goes untested.

**Images:** route `https://cards.scryfall.io/**` to the 1×1 PNG fixture. Real image downloads would make the suite slow and network-dependent for zero assertion value.

---

### Task 5 — Accessibility testing

`@axe-core/playwright`, wired as a reusable helper:

```ts
// tests/support/a11y.ts
export async function expectNoA11yViolations(page: Page, context?: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations, formatViolations(results.violations)).toEqual([])
}
```

Called at the end of every story E2E spec (NFR-2.1). Axe catches contrast, labelling, and roles — it does **not** catch "can a keyboard user actually complete this task". That is why each of D1, D2 and D9 has an explicit keyboard-only journey test in SPEC-D. Automated a11y checks are a floor, not a ceiling.

---

### Task 6 — Contract tests (Scryfall drift detection)

`tests/contract/scryfall.test.ts`, running against the **live** API. Nightly in CI only, never on PRs.

It asserts the shape we depend on, not the data:
- `POST /cards/collection` still accepts an identifiers array and returns `data` + `not_found`.
- The documented max identifiers per collection request is unchanged.
- `GET /cards/search?q=...&unique=prints&order=released&dir=asc` returns `data`, `has_more`, `next_page`.
- Every field in FR-2.12 is present on a known card.
- A known card's oldest paper printing is still what we expect.

**Why this exists:** the mocked suite will stay green forever even after Scryfall changes its API. Mocks test our code against our *belief* about the API. This test checks the belief. When it fails, the fix is `pnpm fixtures:refresh` and a review of the diff.

---

### Task 7 — Test helpers and builders

`tests/support/builders.ts` — domain object builders with sane defaults, so tests state only what they care about:

```ts
export const aCard    = (o?: Partial<Card>): Card => ({ ...defaults, ...o })
export const aDeck    = (o?: Partial<Deck>): Deck => ({ ...defaults, ...o })
export const aMatchup = (o?: Partial<Matchup>): Matchup => ({ ...defaults, ...o })
export const aPlan    = (o?: Partial<SideboardPlan>): SideboardPlan => ({ ...defaults, ...o })
export const aWorkspaceWith = (opts: { matchups?: number; deck?: Deck }) => { /* ... */ }
```

Plus a Playwright page-object per surface (`ImportPage`, `DeckPage`, `PlanPage`, `ExportDialog`) in `tests/support/pages/`. Page objects keep 19 story specs from encoding the same selectors 19 times — when the DOM changes, one file changes.

---

### Task 8 — Story traceability check

`scripts/check-story-coverage.ts`, run in CI: parse the story IDs out of `requirements.md` §6, glob `tests/e2e/*.spec.ts`, and fail if any story has no spec file.

This is what makes "an automated test suite for each of the stories" a mechanically enforced property rather than an intention.

---

## 5. Story → E2E spec map

Every file below is created in its epic's spec. This table is the target state at the end of M3.

| Story | E2E spec file | Projects |
|---|---|---|
| A1 | `A1-paste-decklist.spec.ts` | chromium, `@cross-browser` |
| A2 | `A2-upload-decklist-file.spec.ts` | chromium |
| A3 | `A3-fix-unresolved-card.spec.ts` | chromium |
| A4 | `A4-reimport-preserves-plans.spec.ts` | chromium |
| B1 | `B1-view-deck-images.spec.ts` | chromium, mobile, `@cross-browser` |
| B2 | `B2-group-and-sort.spec.ts` | chromium |
| B3 | `B3-deck-statistics.spec.ts` | chromium, mobile |
| B4 | `B4-card-detail.spec.ts` | chromium |
| C1 | `C1-add-matchup.spec.ts` | chromium |
| C2 | `C2-opponent-decklist.spec.ts` | chromium |
| C3 | `C3-manage-matchups.spec.ts` | chromium |
| C4 | `C4-duplicate-matchup.spec.ts` | chromium |
| D1 | `D1-plan-drag-and-drop.spec.ts` | chromium, tablet |
| D2 | `D2-plan-list-mode.spec.ts` | chromium, mobile |
| D3 | `D3-mode-switch-parity.spec.ts` | chromium |
| D4 | `D4-plan-validation.spec.ts` | chromium, `@cross-browser` |
| D5 | `D5-game-plan-notes.spec.ts` | chromium |
| D6 | `D6-play-draw-split.spec.ts` | chromium |
| D7 | `D7-post-board-preview.spec.ts` | chromium |
| E1 | `E1-export-pdf.spec.ts` | chromium, `@cross-browser` |
| E2 | `E2-export-markdown.spec.ts` | chromium |
| E3 | `E3-mobile-readable-export.spec.ts` | mobile |
| E4 | `E4-workspace-save-restore.spec.ts` | chromium |

---

## 6. Rules for writing tests

1. **Assert on user-visible behaviour**, not implementation. Prefer `getByRole`/`getByText`; use `data-testid` only where no accessible selector exists (drop zones, chart bars).
2. **No conditionals in tests.** An `if` in a test means it's really two tests.
3. **One reason to fail per test.** Multiple assertions are fine if they describe one behaviour.
4. **Never `waitForTimeout`.** Use web-first assertions and `expect.poll`. Timeouts are how a suite becomes flaky.
5. **Fix flakes, never retry them away.** CI retries exist to surface flakes in the report, not to hide them. A test retried into green is an open bug.
6. **Test names state the requirement:** `it('rejects boarding in more copies than the sideboard holds (FR-6.4)')`.
7. **Domain tests never touch the network, the clock, or the DOM.** Inject the clock where time matters (cache TTL, FR-2.5).

---

## 7. Definition of Done

- [x] `pnpm test:unit` runs and reports coverage against the domain threshold.
- [x] `pnpm test:e2e` runs a passing smoke spec against the production build.
- [x] The MSW handlers and the Playwright `ScryfallMock` read the same fixture files.
- [x] `ScryfallMock` supports failure, rate-limit, delay, offline, and request counting.
- [x] `expectNoA11yViolations` passes on the placeholder page.
- [x] `check-story-coverage` runs in CI (it will fail loudly until M3 — that is correct and intended; it is the burn-down list).
- [x] Contract tests exist and are scheduled nightly, excluded from PR runs.

## 8. Deviations from this spec as written

Recorded so later specs stay consistent with what actually exists (mirrors SPEC-000 §6).

| # | Spec said | Reality | Why |
|---|---|---|---|
| 1 | `test:unit: "vitest run"` | `"vitest run --project unit --project dom --coverage"` | A bare `vitest run` would also run the `contract` project, hitting the live Scryfall API on every local/CI unit-test invocation. Coverage is on by default so the 90% domain gate can't be silently skipped. `test:watch` is scoped the same way (minus `--coverage`, for iteration speed). |
| 2 | Fixture/mock paths via `import.meta.url` | Resolved via `process.cwd()` instead | Vitest runs test files as ESM, but Playwright's Node runtime transpiles them to CommonJS, where `import.meta` doesn't exist. `process.cwd()` (always the package root — every `pnpm` script and the CI `working-directory` guarantee it) is the one scheme both runners agree on. |
| 3 | MSW handlers and Playwright `ScryfallMock` "read the same fixture files" | They also share the same resolution *logic*, via `tests/support/scryfallFixtureData.ts` | Stricter than the letter of the spec, cheaply: one function decides how a query resolves, and each transport layer (MSW `HttpResponse` vs Playwright `route.fulfill`) just wraps it. Removes a second place the two layers could disagree. |
| 4 | — | Added `src/domain/export/attribution.test.ts` | Turning on the 90% domain coverage threshold immediately failed against SPEC-000's existing, untested `attribution.ts`. Closing that gap was in scope for "the coverage gate actually works," not a new feature. |
| 5 | Scryfall fixtures implied to be hand-authored/curated | Generated from the **live** API via `scripts/refresh-scryfall-fixtures.ts` | Network access was available while building this spec, so fixtures are real API responses, not approximations. Along the way: `/cards/collection` resolves split cards (e.g. "Fire // Ice") by **front-face name only** — the combined form 404s. Recorded as a comment at the identifier list in the refresh script for whoever builds the resolver in SPEC-A. |
| 6 | — | Contract tests (Task 6) were run against the live API during implementation (2026-08-05) and passed, including confirming the documented `/cards/collection` cap is exactly 75 identifiers. | Verifying the verifier — an untested contract test is exactly the kind of guard rail SPEC-000 warned about. |
| 7 | Task 7 — `tests/support/builders.ts` (`aCard`/`aDeck`/`aMatchup`/`aPlan`) and Playwright page objects (`ImportPage`/`DeckPage`/`PlanPage`/`ExportDialog`) | **Deferred, not built** | Both need shapes that don't exist yet: the builders need `Card`/`Deck`/`Matchup`/`SideboardPlan` from SPEC-002 Task 1, and the page objects need DOM structure from the features SPEC-A/B/C/D/E each build. Writing either now means guessing a shape the later spec might not honor. Add `builders.ts` in SPEC-002 Task 1 alongside the types it wraps; add each page object in the spec that first builds that surface. |
| 8 | `.github/workflows/ci.yml` had `unit`/`e2e` as a TODO, no contract/story-coverage jobs | Added `unit`, `e2e` (sharded 1/2, 2/2), `story-coverage`, and `contract` jobs to the **same** workflow, gated by `if: github.event_name != 'schedule'` / `== 'schedule'` off a new `schedule:` trigger | One file stays the single source of truth for the pipeline rather than splitting nightly-only jobs into a second workflow. |
| 9 | — | E2E CI installs only `chromium`, `firefox`, `webkit` browser binaries | The `mobile` and `tablet` Playwright projects emulate device viewports on the Chromium/WebKit engines already installed — no fourth binary needed. |
