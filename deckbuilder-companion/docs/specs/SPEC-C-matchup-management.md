# SPEC-C — Epic C: Manage Matchups

| | |
|---|---|
| **Depends on** | SPEC-002 (can run parallel to A/B) |
| **Blocks** | SPEC-D |
| **Stories** | C1, C2, C3, C4 |
| **Requirements** | FR-5.x, FR-6.9 |
| **Estimated size** | One session |

---

## 1. Goal

Create, name, annotate, reorder, duplicate and delete matchups — with an optional opponent decklist and an at-a-glance validity indicator per matchup.

## 2. Why this can run in parallel with A and B

Matchups depend on the domain model, not on a resolved deck. Build it against `FakeCardRepository` and a fixture `Deck`; it integrates with the real import path for free.

---

## 3. Domain tasks

### Task C-1 — Matchup factory and operations

`src/domain/model/matchup.ts`

```ts
export function createMatchup(ids: IdFactory, name: string): Matchup
export function duplicateMatchup(ids: IdFactory, source: Matchup): Matchup
export function renameMatchup(m: Matchup, name: string): Matchup
export function reorder<T>(items: readonly T[], from: number, to: number): readonly T[]
```

**Tests first:**
- `createMatchup` produces a unified plan with empty `out`/`in`, `splitPlayDraw: false`, empty `gamePlan`, empty `tags`.
- Name is trimmed; an all-whitespace name is rejected (FR-5.2 — required).
- `duplicateMatchup` **deep-copies plans and notes**, gets a fresh id, and names the copy `"<name> (copy)"`. Then: mutate the copy's plan and assert the source is unchanged. That aliasing test is the whole point of C4 — a duplicate that shares a plan object is a data-loss bug that looks fine until the user edits it.
- Duplicating a matchup with split play/draw plans copies **both** variants.
- `reorder` handles from == to, index 0, last index, and out-of-range indices without throwing.

### Task C-2 — Matchup validity summary

`src/domain/plan/summary.ts` (FR-5.7)

```ts
export type MatchupStatus = 'empty' | 'incomplete' | 'unbalanced' | 'broken' | 'valid'
export function matchupStatus(m: Matchup, ctx: PlanContext): MatchupStatus
```

Precedence, highest first: `broken` (a reference no longer resolves — FR-6.9) → `unbalanced` → `incomplete` (a plan exists but the other variant is empty when split is on) → `empty` → `valid`.

**Tests:** one per status; a split matchup where only `onPlay` is filled is `incomplete`; `broken` outranks `unbalanced` when both apply (a broken reference is the more urgent thing to tell the user about).

### Task C-3 — Store actions

Implement the SPEC-002 task 9 matchup actions for real, plus:
- `removeMatchup` is undoable for the session (FR-5.6) — verify via the `zundo` history, not by a bespoke trash bin.
- `reorderMatchups` delegates to `reorder`.
- Adding a matchup makes it the selected one.
- Removing the selected matchup selects a sensible neighbour, not nothing.

---

## 4. UI tasks

### Task C-4 — Matchup sidebar (C1, C3)

`src/features/matchup/MatchupSidebar.tsx`

- List of matchups, each with name and a status indicator (FR-5.7)
- Status uses **icon + text + colour**, never colour alone (NFR-2.4): `✓ Valid`, `⚠ Unbalanced`, `● Empty`, `✕ Broken`
- "Add matchup" opens an inline name input; Enter creates, Escape cancels
- Per-matchup menu: rename, duplicate, delete
- Reorder via drag handles **and** keyboard (Alt+↑/↓) — a reorder that requires a mouse fails NFR-2.2
- Collapses to a dropdown below the tablet breakpoint
- `data-testid="matchup-list"`, `matchup-item`, `matchup-status`

### Task C-5 — Delete with undo (FR-5.6)

Confirmation dialog, then a toast with an Undo action that stays for ~10 s. Undo restores the matchup with its plans and its original position — assert position, not just existence.

### Task C-6 — Matchup metadata (FR-5.4, priority S)

Priority select (high/medium/low) and a free-text tag input. Priority is display and export ordering only in v1; it drives nothing else.

### Task C-7 — Opponent decklist (C2, FR-5.3, FR-5.8)

Reuses SPEC-A's import path verbatim — same parser, same repository, same unresolved-name UI. Do not fork it.

- A collapsible "Opponent's deck" panel in the matchup view
- Renders with the SPEC-B `DeckView` in a compact mode
- Optional: absent by default, removable
- Opponent decks are **excluded** from FR-4 deck validation warnings — a 62-card opponent list the user typed from memory is not a problem to report.
- Displayed alongside the plan while editing (FR-5.8)

### Task C-8 — Matchup detail shell

`src/features/matchup/MatchupDetail.tsx` — the container SPEC-D fills in: header (name, status, priority), game plan editor slot, sideboard planner slot, opponent deck panel. Build the shell here with the planner slot empty so C's E2E specs can pass before D exists.

---

## 5. E2E specs

### `C1-add-matchup.spec.ts`
1. Import a deck → "Add matchup" → type "Izzet Murktide" → Enter → appears in the sidebar, selected.
2. Status shows `empty` for a new matchup.
3. Whitespace-only name is rejected with a message (FR-5.2).
4. Add five matchups → all five listed in creation order.
5. `expectNoA11yViolations`.

### `C2-opponent-decklist.spec.ts`
1. Open a matchup → add an opponent decklist by pasting a fixture → cards render.
2. The opponent deck stays visible while editing the plan (FR-5.8).
3. A 62-card opponent list produces **no** deck-size warning.
4. Remove the opponent deck → panel gone, matchup otherwise unchanged.

### `C3-manage-matchups.spec.ts`
1. Rename a matchup → new name in the sidebar and in the detail header.
2. Reorder by keyboard (Alt+↓) → order changes; reload of the view preserves it.
3. Delete → confirmation → matchup gone.
4. Undo from the toast → matchup returns **at its original index** with its plan intact (FR-5.6).
5. Deleting the selected matchup selects a neighbour rather than an empty state.

### `C4-duplicate-matchup.spec.ts`
1. Build a plan on matchup A → duplicate → "A (copy)" appears with an identical plan.
2. **Edit the copy's plan → matchup A is unchanged.** This is the aliasing assertion; it is the reason this story has its own spec file.
3. Duplicating a split play/draw matchup copies both variants.
4. Duplicating carries game plan text and per-card notes across.

---

## 6. Definition of Done

- [ ] `duplicateMatchup` deep-copy is proven by a mutation test at both the domain and E2E levels.
- [ ] Matchup status precedence is table-tested.
- [ ] Reorder and delete are fully keyboard-operable.
- [ ] Delete-undo restores position, not just existence.
- [ ] Opponent decklist reuses the SPEC-A import path with no duplicated parsing code.
- [ ] All four C-story E2E specs pass.
