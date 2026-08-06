# SPEC-002 — Domain Core

| | |
|---|---|
| **Depends on** | SPEC-000, SPEC-001 |
| **Blocks** | SPEC-A, SPEC-C |
| **Requirements** | §9 domain model, §10.2 layering, NFR-6.1, NFR-6.2, NFR-6.4, NFR-6.6 |
| **Estimated size** | One session |

---

## 1. Goal

The pure TypeScript heart of the application: types, the `CardRepository` port, plan arithmetic, and the state store. No UI. Everything here is unit-tested at speed and is reusable unchanged by a v2 server.

## 2. Out of scope

Parsing (SPEC-A), Scryfall implementation (SPEC-A), rendering (SPEC-B), export generation (SPEC-E). This spec builds the vocabulary those specs speak.

---

## 3. Tasks

### Task 1 — Model types

`src/domain/model/types.ts` — the requirements §9 model as TypeScript. Notes on the decisions that aren't obvious:

```ts
/** Scryfall oracle_id. Stable across printings and reprints — this is card *identity*. */
export type CardId = string & { readonly __brand: 'CardId' }
export type MatchupId = string & { readonly __brand: 'MatchupId' }

export type Zone = 'maindeck' | 'sideboard'
export type PlanVariant = 'unified' | 'onPlay' | 'onDraw'

export interface DeckEntry {
  readonly cardId: CardId
  readonly quantity: number
  /** Retained from the imported list for round-trip fidelity. Never drives artwork — D-6. */
  readonly listedPrinting?: { set: string; collectorNumber: string }
}

export interface Deck {
  readonly id: string
  readonly name: string
  readonly format: Format
  readonly maindeck: readonly DeckEntry[]
  readonly sideboard: readonly DeckEntry[]
  readonly importedAt: string          // ISO 8601
  readonly sourceText: string          // original paste, for re-parse and diff
}

export interface PlanEntry {
  readonly cardId: CardId
  readonly quantity: number
  readonly note?: string               // FR-6.7
}

export interface SideboardPlan {
  readonly out: readonly PlanEntry[]
  readonly in: readonly PlanEntry[]
}

export interface Matchup {
  readonly id: MatchupId
  readonly name: string
  readonly priority?: 'high' | 'medium' | 'low'
  readonly tags: readonly string[]
  readonly opponentDeck?: Deck
  readonly gamePlan: string            // markdown
  readonly splitPlayDraw: boolean      // FR-6.8
  readonly plans: Partial<Record<PlanVariant, SideboardPlan>>
}

export interface Workspace {
  readonly schemaVersion: 1
  readonly deck?: Deck
  readonly matchups: readonly Matchup[]
}
```

**Branded IDs** are worth the small friction: `CardId` and `MatchupId` are both strings, and passing one where the other belongs is exactly the kind of bug that survives to production. The brand makes it a compile error.

**Everything is `readonly`.** All mutation goes through the action functions in Task 4, which is what makes undo/redo (FR-8.9) a matter of keeping previous states rather than implementing inverse operations.

`PlanValidation` is deliberately **not** in this file — it is derived, never stored (requirements §9, key decision 2). Storing it would let a plan disagree with its own validity.

**RED first:** a type-level test file using `expectTypeOf` asserting `Workspace` is deeply readonly and that `CardId` is not assignable from a bare `string`.

---

### Task 2 — The `CardRepository` port ⭐

`src/domain/ports/CardRepository.ts` (NFR-6.4):

```ts
export interface CardRepository {
  /**
   * Resolve card names to canonical identities plus oldest-print artwork.
   * Implementations MUST batch (FR-2.2, FR-2.15) and MUST NOT throw on
   * individual unresolved names — those come back in `unresolved`.
   */
  resolve(names: readonly CardNameQuery[]): Promise<ResolveResult>

  /** Cache-only lookup. Never performs I/O. Used by export (FR-10.12). */
  peek(cardId: CardId): Card | undefined

  /** Fuzzy suggestion for a failed name — FR-2.10. */
  suggest(name: string): Promise<string | undefined>
}

export interface ResolveResult {
  readonly cards: ReadonlyMap<CardId, Card>
  readonly byQueriedName: ReadonlyMap<string, CardId>
  readonly unresolved: readonly UnresolvedName[]
}
```

This interface is the seam described in requirements §10.3. Everything above it is testable with an in-memory fake; the Scryfall implementation lands in SPEC-A and can be replaced by a server proxy in v2 without any caller changing.

Also write `tests/support/FakeCardRepository.ts` here — every later domain and UI test uses it instead of the network.

---

### Task 3 — Deck queries

`src/domain/deck/queries.ts` — small, total functions with no I/O:

```ts
export function countCards(entries: readonly DeckEntry[]): number
export function copiesOf(deck: Deck, cardId: CardId, zone: Zone): number
export function totalCopiesIn75(deck: Deck, cardId: CardId): number
export function distinctCardIds(deck: Deck): readonly CardId[]
```

**Tests to write first:** empty deck → 0; a card in both zones counts independently per zone (this is the FR-6.5 case, and getting it wrong here poisons all of SPEC-D); duplicate entries already merged by the parser are not double-counted.

---

### Task 4 — Plan actions ⭐

`src/domain/plan/actions.ts`. This is the core of the product; test it hardest.

```ts
export interface PlanContext { readonly deck: Deck }

export function addOut(plan: SideboardPlan, ctx: PlanContext, cardId: CardId, qty = 1): SideboardPlan
export function addIn(plan: SideboardPlan, ctx: PlanContext, cardId: CardId, qty = 1): SideboardPlan
export function setOutQuantity(plan: SideboardPlan, ctx: PlanContext, cardId: CardId, qty: number): SideboardPlan
export function setInQuantity(plan: SideboardPlan, ctx: PlanContext, cardId: CardId, qty: number): SideboardPlan
export function setEntryNote(plan: SideboardPlan, side: 'out' | 'in', cardId: CardId, note: string): SideboardPlan
export function clearPlan(plan: SideboardPlan): SideboardPlan
```

Invariants every action upholds — each is one test:

| # | Invariant | Requirement |
|---|---|---|
| 1 | Returns a new object; the input is never mutated. | Enables undo/redo |
| 2 | OUT quantity is clamped to `[0, copiesOf(deck, id, 'maindeck')]`. | FR-6.3, FR-9.3 |
| 3 | IN quantity is clamped to `[0, copiesOf(deck, id, 'sideboard')]`. | FR-6.4, FR-9.3 |
| 4 | Clamping is silent, not an error — the UI prevents the action first (FR-7.4); this is defence in depth. | FR-7.4 |
| 5 | Setting quantity to 0 removes the entry rather than leaving a zero-quantity row. | Cleanliness |
| 6 | A card in both zones is tracked independently in `out` and `in`. | FR-6.5 |
| 7 | A card with 0 copies in the relevant zone is a no-op. | FR-6.3/6.4 |
| 8 | Adding to an existing entry sums, and re-clamps after summing. | FR-1.7.7 analogue |
| 9 | Notes survive quantity changes; removing an entry removes its note. | FR-6.7 |

Invariant 8 deserves emphasis: `addOut(plan, ctx, id, 3)` twice on a 4-of must yield 4, not 6. Write that test.

Consider a property-based test (`fast-check`) over invariants 1–3: for any sequence of random actions, no quantity ever exceeds the available copies. That single property covers combinations an example-based suite will miss.

---

### Task 5 — Plan validation

`src/domain/plan/validate.ts`:

```ts
export type PlanIssueCode =
  | 'unbalanced'            // FR-7.2
  | 'under-minimum-deck'    // FR-7.3
  | 'exceeds-maindeck'      // FR-6.3 — defence in depth
  | 'exceeds-sideboard'     // FR-6.4
  | 'broken-reference'      // FR-6.9
  | 'empty'                 // plan has no entries at all

export interface PlanIssue {
  readonly code: PlanIssueCode
  readonly severity: 'error' | 'warning'
  readonly message: string        // human-readable, e.g. "2 out, 3 in — 1 too many"
  readonly cardId?: CardId
}

export interface PlanValidation {
  readonly outTotal: number
  readonly inTotal: number
  readonly delta: number          // inTotal - outTotal
  readonly postBoardSize: number
  readonly issues: readonly PlanIssue[]
  readonly isValid: boolean       // no issues of severity 'error'
}

export function validatePlan(plan: SideboardPlan, ctx: PlanContext): PlanValidation
```

**Tests to write first:**
- Empty plan → `empty` warning, `isValid` false, `postBoardSize` = maindeck size.
- Balanced 3-for-3 → no issues, `isValid` true.
- 2 out / 3 in → `unbalanced`, message contains "2 out, 3 in" and "1 too many" (FR-7.2 names the copy explicitly; assert it).
- 3 out / 2 in on a 60-card deck → both `unbalanced` and `under-minimum-deck`.
- 61-card maindeck, 3 out / 2 in → `unbalanced` but **not** `under-minimum-deck` (post-board 60). This is the test that stops the two rules from being conflated.
- A plan entry referencing a card no longer in the deck → `broken-reference` with `cardId` set (FR-6.9).
- `isValid` false must never prevent construction — validation reports, it does not block (FR-7.6).

---

### Task 6 — Post-board deck

`src/domain/plan/postBoard.ts` (FR-6.10):

```ts
export function postBoardDeck(deck: Deck, plan: SideboardPlan): Deck
```

**Tests:** cards fully boarded out disappear from the maindeck; partial boards reduce quantity; boarded-in cards appear in the maindeck and are decremented from the sideboard; a card in both zones is handled correctly; the operation is pure.

---

### Task 7 — Deck validation

`src/domain/deck/validate.ts` (FR-4.1–4.3):

```ts
export function validateDeck(deck: Deck, repo: CardRepository): readonly DeckIssue[]
```

FR-4.3 (the 4-copy rule) needs card text, hence the repository. Rules:
- Basic lands are exempt.
- Cards whose oracle text contains "A deck can have any number of cards named" are exempt (Relentless Rats, Dragon's Approach, Persistent Petitioners).
- Cards with an explicit numeric limit in oracle text (Seven Dwarves, Nazgûl) use that limit.
- If the card is not resolvable, **skip the check** rather than warning. A false warning on a card we simply failed to look up is worse than a missed warning.

Isolate the exemption logic in `deckLimitFor(card): number` and table-test it. FR-4.3 is `S` priority — this can be stubbed to `4` initially and filled in later without touching callers.

---

### Task 8 — Plan reconciliation

`src/domain/plan/reconcile.ts` (FR-6.9, story A4) — the subtle one:

```ts
export interface ReconcileResult {
  readonly plan: SideboardPlan
  readonly changes: readonly ReconcileChange[]
}
export function reconcilePlan(plan: SideboardPlan, oldDeck: Deck, newDeck: Deck): ReconcileResult
```

Rules, each a test:
1. Card still present at ≥ the planned quantity → entry unchanged.
2. Card present but at a **lower** quantity → clamp down, record a `reduced` change.
3. Card gone from the relevant zone → **keep the entry, mark it broken**, record a `broken` change. Do not delete it. FR-6.9 is explicit that entries are flagged, not silently dropped — the user needs to see what they lost to decide what replaces it.
4. Card moved maindeck ↔ sideboard → treat as removed from the old zone; report it as `moved` so the message can be useful.
5. Reconciliation never invents entries.

Rule 3 is the requirement most likely to be implemented wrong by reflex (deleting is easier). Write its test before the code.

---

### Task 9 — Zustand store

`src/state/workspaceStore.ts`. Thin: it holds state and delegates every mutation to a domain function.

```ts
interface WorkspaceState {
  workspace: Workspace
  status: 'empty' | 'importing' | 'ready' | 'error'
  // deck
  setDeck(deck: Deck): void
  // matchups — SPEC-C
  addMatchup(name: string): MatchupId
  renameMatchup(id: MatchupId, name: string): void
  duplicateMatchup(id: MatchupId): MatchupId
  removeMatchup(id: MatchupId): void
  reorderMatchups(from: number, to: number): void
  // plans — SPEC-D
  editPlan(id: MatchupId, variant: PlanVariant, fn: (p: SideboardPlan, ctx: PlanContext) => SideboardPlan): void
  setSplitPlayDraw(id: MatchupId, split: boolean): void
  setGamePlan(id: MatchupId, markdown: string): void
}
```

Rules:
- **No business logic in the store.** `editPlan` takes a domain function and applies it. If a rule ever appears here, it belongs in `src/domain/plan/`.
- Wrap with `zundo` for undo/redo (FR-8.9), with a partializer excluding `status` — undoing into a stale loading state would be a bug.
- Test with Vitest directly against `createStore`, no React and no rendering.

**Tests to write first:** `addMatchup` returns a usable id and appends; `duplicateMatchup` deep-copies the plan so editing the copy doesn't touch the original (this is the aliasing bug that `readonly` types make unlikely but doesn't fully prevent); `removeMatchup` followed by undo restores the matchup with its plans intact (FR-5.6); `editPlan` on a nonexistent matchup is a no-op, not a throw.

---

### Task 10 — ID generation

`src/domain/model/ids.ts`:

```ts
export function createIdFactory(source: () => string): IdFactory
```

Inject the generator; do not call `crypto.randomUUID()` inline. Tests need deterministic IDs, and workspace-JSON snapshot assertions in SPEC-E become impossible if IDs are random at construction time.

---

## 4. Definition of Done

- [x] `src/domain/**` has ≥ 90% line and branch coverage. (100% lines/branches/functions/statements as of implementation.)
- [x] Not one file under `src/domain/` imports React, Next.js, `zustand`, or `fetch` (lint-enforced).
- [x] Plan actions have a property-based test proving quantities never exceed availability.
- [x] `FakeCardRepository` exists and is used by every domain test that needs a `CardRepository` (only `deck/validate.ts` takes one in this spec).
- [x] Store tests run without a DOM.
- [x] `reconcilePlan` keeps and flags broken entries rather than deleting them, with a test that would fail if someone "simplifies" it to a delete.

## 5. Deviations from this spec as written

Recorded so later specs stay consistent with what actually exists (mirrors SPEC-000 §6, SPEC-001 §8).

| # | Spec said | Reality | Why |
|---|---|---|---|
| 1 | `PlanEntry` has no `broken` field (Task 1) | Added `readonly broken?: boolean` | Task 8's rule 3 ("keep the entry, mark it broken") needs somewhere to persist that flag on the entry itself so it survives beyond a single `reconcilePlan` call; the `ReconcileChange` list is ephemeral per-call, not part of the stored model. |
| 2 | Task 1's type-level "deeply readonly" test uses a generic recursive `DeepReadonly<T>` | Used per-interface `Readonly<T>` equality checks plus explicit `readonly X[]` checks on every array field instead | A fully-generic recursive `DeepReadonly<T>` recurses into branded primitives (`CardId` structurally `extends object`) and blows past TypeScript's instantiation budget on a model this size, silently widening unrelated fields to `never`. The per-field approach covers the same ground without the recursion hazard. |
| 3 | `tests/support/builders.ts` and Vitest resolve `@/*` implicitly | Added `resolve.alias` to every Vitest project in `vitest.config.ts` | Vitest doesn't read `tsconfig.json` paths on its own; each `projects` entry is an independent Vite config, so the alias has to be repeated per project rather than set once at the root. |
| 4 | `tests/support/FakeCardRepository.ts` gets "written" (Task 2) | Also added `tests/support/FakeCardRepository.test.ts` and included `tests/support/**/*.test.ts` in the `unit` Vitest project | Cheap to verify the fake's own contract (batch resolve, per-name unresolved reporting, cache-only `peek`) directly, and every later domain test depends on this fake behaving correctly. |
| 5 | Task 7's `validateDeck`/`DeckIssue` shape | No `severity` field on `DeckIssue` (unlike `PlanIssue` in Task 5) | FR-4 validation is advisory-only with no error/warning distinction in the requirements; adding one would be an unrequested feature. |
| 6 | — | Added `zustand`, `zundo`, `fast-check` as dependencies | First specs to actually use them, per SPEC-000 §6 deviation 7's convention of installing a dependency in the spec that first needs it. |
