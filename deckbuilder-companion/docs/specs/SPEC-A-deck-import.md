# SPEC-A — Epic A: Import a Deck

| | |
|---|---|
| **Depends on** | SPEC-002 |
| **Blocks** | SPEC-B |
| **Stories** | A1, A2, A3, A4 |
| **Requirements** | FR-1.x, FR-2.x, FR-4.x, D-6, NFR-1.1, NFR-1.2, NFR-4.2, NFR-5.4 |
| **Estimated size** | Two sessions (parser; then Scryfall + UI) |

---

## 1. Goal

Paste or upload an MTGO decklist and end up with a fully resolved `Deck` in the store — every card identified, oldest-print artwork attached, unresolved names surfaced with a one-click fix.

## 2. Design overview

```
raw text ──▶ parseDecklist ──▶ ParsedDecklist ──▶ CardRepository.resolve ──▶ Deck
             (pure, sync)      (names + qty)      (batched, cached)
                                                          │
                                          ┌───────────────┴───────────────┐
                                    Phase 1: identity            Phase 2: oldest print
                                    POST /cards/collection       GET /cards/search
```

Parsing is pure and synchronous and knows nothing about Scryfall. That separation is what lets the 60+ parser cases run in milliseconds.

---

## 3. Part 1 — The Parser

### Task A-1 — Line tokenizer

`src/domain/parser/tokenize.ts`

```ts
export type Line =
  | { kind: 'card'; quantity: number; name: string; printing?: Printing; lineNumber: number; raw: string }
  | { kind: 'blank'; lineNumber: number }
  | { kind: 'comment'; lineNumber: number }
  | { kind: 'section'; section: 'deck' | 'sideboard'; lineNumber: number }
  | { kind: 'unparseable'; reason: string; lineNumber: number; raw: string }

export function tokenizeLines(input: string): readonly Line[]
```

`lineNumber` and `raw` are carried on every token because story **A3** requires pointing at the exact failing line. Adding them later means touching every call site.

**Tests first** (`tokenize.test.ts`) — table-driven:

| Input | Expected |
|---|---|
| `4 Lightning Bolt` | card, qty 4 |
| `4x Lightning Bolt` | card, qty 4 (FR-1.7 `x` variant) |
| `Lightning Bolt` | card, qty 1 (FR-1.7.5) |
| `4 Lightning Bolt (2XM) 129` | card, qty 4, printing `{set:'2xm', collectorNumber:'129'}` (FR-1.7.6) |
| `SB: 3 Chalice of the Void` | card in sideboard, qty 3 |
| `// comment` / `# comment` | comment (FR-1.7.2) |
| `Sideboard` / `Sideboard:` / `SIDEBOARD` | section (case-insensitive) |
| `Deck` / `Maindeck` | section |
| `` (empty) / `   ` | blank |
| `\r\n` line endings | normalised (FR-1.7.1) |
| `4 Fire // Ice` | card, name `Fire // Ice` (FR-1.7.4) |
| `4  Lightning   Bolt` | internal whitespace collapsed |
| `Lim-Dûl's Vault` | name preserved with diacritics |
| `!!!` | unparseable with a reason |
| `0 Lightning Bolt` | unparseable — zero is meaningless |
| `999 Lightning Bolt` | card, qty 999 — parser doesn't validate legality, FR-4 does |

Note the last row. The parser's job is to read what's written; deck legality is FR-4's job. Keeping that boundary clean prevents "helpful" parser behaviour that discards user input.

---

### Task A-2 — Zone assignment ⭐

`src/domain/parser/assignZones.ts` — the genuinely tricky part of FR-1.7.3.

Precedence, highest first:
1. **`SB:` prefix present anywhere** → that prefix alone decides the zone. Blank lines are ignored entirely.
2. **An explicit `Sideboard` section header present** → the header decides. Blank lines are ignored entirely.
3. **Neither** → the *first* blank-line run that has card lines on both sides splits maindeck from sideboard.
4. **No blank line either** → everything is maindeck, sideboard empty.

**Tests first:**
- Blank lines inside a `Sideboard`-header list must not create a third zone (rule 2). This is the common failure mode: a Moxfield export with a blank line between creature and land blocks.
- A list with *both* `SB:` prefixes and blank lines follows rule 1.
- Leading and trailing blank lines are never treated as separators.
- Multiple consecutive blank lines count as one separator.
- A list with a blank line but no cards after it → all maindeck, no empty sideboard section.

---

### Task A-3 — Parse and merge

`src/domain/parser/parseDecklist.ts`

```ts
export interface ParsedEntry {
  readonly name: string
  readonly quantity: number
  readonly zone: Zone
  readonly printing?: Printing
  readonly sourceLines: readonly number[]   // plural — merged entries have several
}
export interface ParsedDecklist {
  readonly entries: readonly ParsedEntry[]
  readonly problems: readonly ParseProblem[]
  readonly detectedVariant: DecklistVariant  // for telemetry and the parse summary
}
export function parseDecklist(input: string): ParsedDecklist
```

**Tests first:** one test per fixture in `tests/fixtures/decklists/` asserting exact maindeck and sideboard counts and entry lists. Then:
- Duplicate names in the same zone merge, summing quantities, `sourceLines` holding both (FR-1.7.7).
- The same name in *different* zones does **not** merge.
- Name matching for merge purposes is case- and whitespace-insensitive, but the **first-seen casing is preserved** in the output.
- `parseDecklist('')` returns empty entries and no problems — not an error.
- **NFR-1.1:** a 75-card list parses in < 100 ms (assert with a generous 200 ms bound; a perf test that flakes gets deleted, and a deleted test protects nothing).

---

### Task A-4 — `.dek` XML parser (FR-1.3, priority S)

`src/domain/parser/parseDekXml.ts` — MTGO's XML export. Extract `<Cards Name=... Quantity=... Sideboard=...>`. Normalise into the same `ParsedDecklist`, so everything downstream is unchanged.

**Tests:** valid `.dek` → correct zones; malformed XML → a `ParseProblem`, never a thrown exception escaping the domain.

Defer this if time is short — it's `S` priority and the plain-text path covers the large majority of users.

---

## 4. Part 2 — Card Resolution

### Task A-5 — Printing policy ⭐

`src/domain/printing/policy.ts` (FR-2.13, FR-2.14, D-6). Pure, no I/O, exhaustively testable.

```ts
export interface PrintingCandidate {
  readonly id: string
  readonly set: string
  readonly setType: string
  readonly releasedAt: string      // ISO date
  readonly games: readonly string[]
  readonly digital: boolean
  readonly collectorNumber: string
  readonly imageUris?: ImageUris
}

export function isEligiblePrinting(c: PrintingCandidate): boolean
export function selectOldestPrinting(candidates: readonly PrintingCandidate[]): PrintingCandidate | undefined
```

Eligibility rules:

| Rule | Reason |
|---|---|
| `games` includes `'paper'` | Excludes Arena/MTGO-only and Alchemy rebalances — those aren't real printings. |
| `digital === false` | Same. |
| `setType` not in `{memorabilia, token, minigame, alchemy}` | Excludes oversized and non-card products. |
| Has a usable image | A printing with no scan defeats the purpose. |

Tiebreak when release dates are equal (FR-2.14 requires determinism — two users, or the same user twice, must never see different art):
1. Earlier `releasedAt`.
2. Then non-promo set type over promo.
3. Then lexicographically smaller set code.
4. Then numerically smaller collector number.

**Tests first** — table-driven, one row per rule and one per tiebreak level, plus:
- Empty candidate list → `undefined`, not a throw.
- All candidates ineligible → `undefined` (caller falls back per FR-2.16).
- Two identical-date printings always return the same one across repeated calls with shuffled input order. Assert this explicitly by shuffling — non-determinism here is invisible until a user notices their art changed.

**Judgement call to flag:** the oldest paper printing of some cards is a Collectors' Edition or an old promo with a poor scan. The policy module is where you'd add exclusions if the results look wrong in practice. Test the policy, not the art, so those adjustments stay cheap.

---

### Task A-6 — Scryfall client

`src/adapters/scryfall/ScryfallClient.ts`. Raw HTTP only — no caching, no domain types.

```ts
export class ScryfallClient {
  collection(identifiers: readonly ScryfallIdentifier[]): Promise<CollectionResponse>
  searchPrints(names: readonly string[]): Promise<readonly ScryfallCard[]>
  namedFuzzy(name: string): Promise<ScryfallCard | undefined>
}
```

Requirements to implement here:
- **FR-2.2** — chunk `collection` to the API's documented max identifiers per request. Read the current limit from Scryfall's docs at implementation time and put it in one named constant; the contract test (SPEC-001 task 6) guards it.
- **FR-2.3** — a request queue enforcing ≤ 10 req/s with a ≥ 100 ms gap. Inject the clock and sleep function so tests don't actually wait.
- **FR-2.4** — `User-Agent` and `Accept: application/json` on every request.
- **FR-2.11** — exponential backoff with jitter on 429 and 5xx; give up after N attempts and report, never throw past the boundary.
- **NFR-6.6** — every response validated with Zod before it becomes a domain type. Scryfall is an external system; trusting its shape at the type level is how you get a runtime crash on a field that went null.

`searchPrints` builds the batched oldest-print query (**FR-2.15**):

```
q = (!"Card A" or !"Card B" or ...) game:paper
unique=prints & order=released & dir=asc
```

Chunk by **encoded URL length**, not by name count — a chunk of long card names blows a length limit that a chunk of short ones doesn't. Follow `has_more`/`next_page` pagination. Typical 75-card deck (~25 distinct cards): 1–2 requests total instead of 25.

**Tests first** (Vitest + MSW): chunking at the boundary (n, n+1 identifiers); the rate limiter spaces calls (fake timers); 429 → retry → success; 429 × max → a reported failure, not a throw; a malformed response fails Zod validation with a useful message; the `User-Agent` header is present; a query longer than the URL budget splits into two requests.

---

### Task A-7 — Cache

`src/adapters/scryfall/CardCache.ts` (FR-2.5, FR-2.6).

Two tiers: an in-memory `Map` for the session, and `localStorage` for persistence, keyed by oracle id, with `cachedAt` and a **≥ 7-day TTL**. Inject the clock.

**Tests first** (`.dom.test.ts`, jsdom project):
- Warm cache returns without touching the client — assert the client mock received **zero** calls (FR-2.6 is only meaningful as a call-count assertion).
- Expired entries are refetched.
- Corrupt `localStorage` JSON is discarded, not thrown on (NFR-4.4).
- A `QuotaExceededError` on write degrades to memory-only and keeps working. A 75-card deck's card data is comfortably small, but a user with many decks over months will hit quota, and a crash on cache write would be an absurd way to lose a session.
- Cache keys are namespaced and versioned (`dbc:cards:v1:<oracleId>`) so a schema change can invalidate cleanly.

---

### Task A-8 — `ScryfallCardRepository`

`src/adapters/scryfall/ScryfallCardRepository.ts` — implements the SPEC-002 port, composing client + cache + printing policy.

`resolve()` algorithm:
1. Split requested names into cache hits and misses.
2. **Phase 1** — `collection()` on the misses → canonical identity, oracle id, all FR-2.12 fields. Names Scryfall returns in `not_found` become `unresolved`.
3. **Phase 2** — `searchPrints()` on the resolved names → group candidates by `oracle_id` → `selectOldestPrinting` per card → attach `imageUris` (FR-2.13).
4. **FR-2.16 fallback** — if phase 2 yields nothing for a card, keep phase 1's default-printing images and mark `printingFallback: true` so the UI can be honest about it.
5. Write everything to cache; return the `ResolveResult`.

**Tests first:**
- Happy path: 25 distinct names → exactly 1 collection request + 1 search request (**FR-2.2, FR-2.15** — assert the counts).
- Second call with the same names → **0** requests (FR-2.6).
- One unresolvable name → the other 24 resolve normally and the failure is reported, not fatal (FR-2.10). The whole deck failing because of one typo is the single worst import experience, and this test is what prevents it.
- Phase 2 fails entirely → all cards still resolve with fallback art and `printingFallback` set (FR-2.16).
- A DFC resolves with both faces populated (FR-2.9).
- A split card (`Fire // Ice`) resolves whether the input was the full or front-only name (FR-1.7.4).
- The oldest printing is selected — assert against a fixture where the newest printing is first in the response array, so an implementation that takes `data[0]` fails.

---

### Task A-9 — Import orchestration

`src/state/importDeck.ts` — the store action tying it together:

```
parseDecklist → resolve names → build Deck → validateDeck → reconcile plans (A4) → commit
```

Emits progress states (`parsing` → `resolving` → `ready` | `partial` | `error`) so the UI can show a real loading state rather than a spinner of unknown duration on a 75-card cold-cache import.

---

## 5. Part 3 — UI

### Task A-10 — Import screen (A1, A2)

`src/features/import/ImportScreen.tsx`

- Large textarea, `data-testid="import-textarea"` (FR-1.1)
- File picker + drop zone accepting `.txt` and `.dek` (FR-1.2), **1 MB cap, plain-text/XML read only** (NFR-5.4)
- Import button, disabled while empty
- Loading state driven by A-9's progress states

### Task A-11 — Parse summary (FR-1.5)

Shown **before** commit: maindeck count, sideboard count, detected variant, unresolved names, deck warnings from FR-4. The user confirms before the deck replaces what's there.

Deck warnings render as dismissible banners and never block the confirm button (FR-4.4).

### Task A-12 — Unresolved-name correction (A3)

For each unresolved name: the raw line, its line number, the reason, and — where `namedFuzzy` returns one — a **"Did you mean *X*?"** button that fixes that entry in place (FR-2.10). No re-paste. An "edit manually" fallback for when there's no suggestion.

### Task A-13 — Re-import (A4)

Importing over an existing deck warns that plans may be affected, then runs `reconcilePlan` (SPEC-002 task 8) across every matchup and shows a summary: which matchups are unchanged, reduced, or broken, and which specific cards broke.

---

## 6. E2E specs

### `A1-paste-decklist.spec.ts` — `@cross-browser`
1. Paste `modern-izzet-murktide.txt` → parse summary shows 60 / 15 → confirm → deck view shows 75 cards.
2. Each variant fixture from FR-1.7 imports to the correct counts (loop over fixtures).
3. A deck with 58 maindeck shows the FR-4.1 warning and still imports (FR-4.4).
4. Cold import completes within 3 s against the mock (NFR-1.2).
5. Re-import the same list → `scryfall.requestCount()` is 0 (FR-2.6).
6. `expectNoA11yViolations`.

### `A2-upload-decklist-file.spec.ts`
1. `setInputFiles` with a `.txt` fixture → same result as pasting.
2. Drag-and-drop a file onto the drop zone → same result.
3. A `.dek` XML fixture imports correctly (skip if A-4 deferred).
4. A 2 MB file is rejected with a clear message, no crash (NFR-5.4).

### `A3-fix-unresolved-card.spec.ts`
1. Import `unresolvable.txt` → summary names the bad line and its line number.
2. "Did you mean Lightning Bolt?" → click → entry corrected, count updates, warning clears.
3. Import proceeds with the other 74 cards intact even if the bad name is left unfixed.
4. `scryfall.fail('collection')` → clear error message and a retry affordance, never a blank screen (NFR-4.2).

### `A4-reimport-preserves-plans.spec.ts`
1. Import a deck, create a matchup, build a 3-for-3 plan.
2. Re-import a list where one planned card dropped from 4 copies to 2 → plan quantity clamps to 2, matchup flagged `reduced`.
3. Re-import a list where a planned card is gone entirely → entry **still visible**, flagged broken (FR-6.9). Assert the entry is present — this test exists specifically to fail if someone changes reconciliation to delete.
4. Matchups untouched by the change show no warning.

---

## 7. Definition of Done

- [x] Every fixture in `tests/fixtures/decklists/` has a passing parser test.
- [x] Parser coverage ≥ 90% branches (92.85% aggregate across `src/domain/parser/**`).
- [x] A 25-distinct-card deck resolves in ≤ 2 Scryfall requests; a repeat import in 0.
- [x] Oldest-print selection is proven deterministic under shuffled input.
- [x] One bad card name never blocks the other 74.
- [x] All four A-story E2E specs pass.
- [x] No a11y violations on the import screen.

## 8. Deviations from this spec as written

Recorded so later specs stay consistent with what actually exists (mirrors SPEC-002 §6 / SPEC-001 §8).

| # | Spec said | Reality | Why |
|---|---|---|---|
| 1 | `ParsedDecklist.detectedVariant: DecklistVariant` — type left implicit | `DecklistVariant = "sbPrefix" \| "sectionHeader" \| "blankLineSplit" \| "maindeckOnly" \| "dekXml"`, defined and computed in `assignZones.ts` | The four text-parsing variants fall directly out of the A-2 zone-assignment precedence rules (one `computeZones` helper returns both the zone map and which rule fired); `.dek` XML has no zone-precedence question, so `parseDekXml.ts` sets `"dekXml"` directly. |
| 2 | Task A-3's `ParsedEntry`/merge logic implied to live entirely in `parseDecklist.ts` | Merge logic factored into `src/domain/parser/mergeEntries.ts`, shared by `parseDecklist.ts` and `parseDekXml.ts` | Task A-4's `.dek` parser needs the identical "same zone merges, cross-zone doesn't, first-seen casing wins" rule (FR-1.7.7). One shared function is cheaper than duplicating it and letting the two parsers drift. |
| 3 | Task A-8's `resolve()` described as splitting "requested names into cache hits and misses" against `CardCache` | `ScryfallCardRepository` keeps its own in-memory `Map<normalizedName, CardId>` (`nameIndex`), checked *and* warm-`CardCache`-backed, to decide a hit | `CardCache` (task A-7) is keyed by `CardId`, not by the name string a user typed — there's no way to ask "have I resolved this name before" from the id-keyed cache alone. The name index is the missing piece; a warm cache entry without a name-index hit still counts as a miss (it'd need Phase 1 to re-learn the name→id mapping), which is the conservative, correct direction to err. |
| 4 | Domain model (SPEC-002) `Card` type not to be redefined by SPEC-A | Added one optional field: `Card.printingFallback?: boolean` | FR-2.16 explicitly requires the UI be able to tell when a card is showing phase-1 default art because phase-2 (oldest-print search) found nothing for it. There was nowhere else to carry that fact. Additive and optional — every SPEC-002 test and fixture still holds. |
| 5 | `WorkspaceStatus` (SPEC-002) = `"empty" \| "importing" \| "ready" \| "error"` | Changed to `"empty" \| "parsing" \| "resolving" \| "ready" \| "partial" \| "error"` | `"importing"` was defined in SPEC-002 but never produced by any action — it was reserved for exactly this spec's use. `parsing`/`resolving` are the granular progress states A-9 asks for; `partial` is FR-4.4's "imported, but there's something to look at" state (unresolved names and/or validation warnings). No existing test referenced `"importing"`. |
| 6 | Task A-9 described as one `importDeck` store action (parse → resolve → build → validate → reconcile → commit) | Split into `previewImport` (parse → resolve → build → validate, **no commit**) and `commitImport` (setDeck → reconcile) | FR-1.5 requires the parse summary to be "shown before commit" with the user confirming before the deck replaces what's there. A single all-in-one action can't stop partway through for a confirmation click. The split is the same pipeline; it just returns control to the UI at the natural pause point. |
| 7 | — | Added `Card.printingFallback` aside, `ScryfallClient.fetchImpl` binds `fetch` to `globalThis` explicitly | Found by actually running the import screen in a browser (`pnpm dev`), not by the test suite: `this.fetchImpl(...)` — an unbound native `fetch` reference called through a property access — throws `TypeError: Illegal invocation` in real browsers (`fetch` requires `window` as its receiver). Node's `fetch` doesn't enforce this, so every MSW-backed unit test passed while the browser silently failed on the very first Scryfall request. Fixed by binding at construction (`fetch.bind(globalThis)`); this is exactly the kind of gap CLAUDE.md's "test the golden path in a browser" instruction exists to catch. |
| 8 | — | `previewImport` catches a total `repository.resolve()` failure (not just individual unresolved names) and returns `status: "error"` with `errorMessage`/`retryable`, instead of letting the rejection propagate | Discovered while writing the A3 "Scryfall down" E2E case: an uncaught rejection here left the UI stuck on "Importing…" forever with no feedback — the exact "blank screen" NFR-4.2 forbids. `ParseSummary` now renders a retry affordance for this case. |
| 9 | `scripts/refresh-scryfall-fixtures.ts`'s `COLLECTION_NAMES` — SPEC-002's 22-card pool, curated for unit tests | Extended to 49 names: every distinct real card name across all of `tests/fixtures/decklists/*.txt` (deliberately excluding "Lightnin Bolt" and the two junk lines in `malformed.txt`, which must stay unresolved) | The A1 E2E spec pastes whole decklist fixtures and asserts exact maindeck/sideboard counts against the mock. SPEC-002's 22-card pool was sized for domain/adapter unit tests with hand-picked names, not for "import a realistic 75-card decklist end to end." Regenerated via `pnpm fixtures:refresh` against the live API per SPEC-001's sanctioned workflow; diff reviewed before committing. |
| 10 | A1's E2E spec (§6) implies every decklist fixture round-trips through the mock | `accented.txt` is excluded from the "loop over every fixture" E2E test | Live Scryfall accepts "Æther Vial" (æ ligature) and returns canonical "Aether Vial" — a normalization the shared mock (`scryfallFixtureData.ts`, exact lowercase string matching) doesn't replicate. `Lim-Dûl's Vault` and `Nazgûl` round-trip fine (their diacritics survive canonicalization); only the æ ligature doesn't. Parsing `accented.txt` itself is fully covered at the unit level (`parseDecklist.test.ts`); this is purely a mock-fidelity gap for one card. |
| 11 | A4's E2E spec (§6): create a matchup, build a 3-for-3 plan, re-import a reduced list, assert clamping and `broken` flagging | `A4-reimport-preserves-plans.spec.ts` covers only the re-import flow and reconciliation-summary rendering with zero matchups | Matchup creation and plan editing have no UI yet — those are SPEC-C and SPEC-D, not built in this session. There is nothing to click. The reconciliation *logic* (`reconcilePlan`) and its integration with `commitImport` (clamping, `broken`/`moved` flagging, untouched matchups producing no changes) are fully covered at the unit level in `src/domain/plan/reconcile.test.ts` (SPEC-002) and `src/state/importDeck.test.ts` (this spec). Revisit this E2E spec once SPEC-C/D land — it's the natural place to add the full story. |
| 12 | Task A-6: `ScryfallClient` behavior only specified narratively | Rate limiting (FR-2.3), retry/backoff (FR-2.11), and chunking (FR-2.2, FR-2.15) all take injectable `now`/`sleep`/`random`/`searchQueryUrlBudget` | Matches SPEC-001's "inject the clock and sleep function so tests don't actually wait" instruction for task A-6 specifically; `searchQueryUrlBudget` additionally lets tests force query-splitting deterministically without constructing artificially long card names. |
