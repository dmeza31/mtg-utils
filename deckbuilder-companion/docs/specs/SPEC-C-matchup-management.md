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

- [x] `duplicateMatchup` deep-copy is proven by a mutation test at both the domain and E2E levels.
- [x] Matchup status precedence is table-tested.
- [x] Reorder and delete are fully keyboard-operable.
- [x] Delete-undo restores position, not just existence.
- [x] Opponent decklist reuses the SPEC-A import path with no duplicated parsing code.
- [x] All four C-story E2E specs pass.

## 7. Deviations from this spec as written

Recorded so later specs stay consistent with what actually exists (mirrors SPEC-B §7 / SPEC-A §8 / SPEC-002 §6 / SPEC-001 §8).

| # | Spec said | Reality | Why |
|---|---|---|---|
| 1 | `createMatchup` test bullet: "produces a unified plan with empty `out`/`in`" | `createMatchup` sets `plans: { unified: { out: [], in: [] } }`; SPEC-002's original store action set `plans: {}` (lazily creating `unified` on first edit) | The spec's own C-1 test explicitly wants an initialized unified plan. Changed `addMatchup`'s existing unit test expectation to match — a real, intentional behaviour change from SPEC-002, not a bug. `editPlan`'s existing `?? EMPTY_PLAN` fallback still works identically either way, so nothing downstream broke. |
| 2 | `createMatchup` / `renameMatchup` signatures return `Matchup` (non-optional); "an all-whitespace name is rejected" | Both throw a plain `Error` on an empty/whitespace name after trimming, rather than returning `undefined` or a result type | A non-optional return type and "reject invalid input" are only reconcilable by throwing. The store's `addMatchup`/`renameMatchup` actions don't catch it — it propagates to the UI, which does catch it (`MatchupSidebar`'s inline add/rename forms) to show the FR-5.2 message the E2E spec checks for. Domain throws, UI decides what to say — the same split SPEC-A used for file-upload validation. |
| 3 | Task C-2: `matchupStatus(m: Matchup, ctx: PlanContext): MatchupStatus` | `ctx` is accepted (signature match) but not read — `broken` comes from the `PlanEntry.broken` flag `reconcilePlan` (SPEC-002 task 8) already writes into the stored plan, not re-derived from the deck | Re-deriving brokenness from `ctx.deck` would duplicate reconciliation logic that already exists and already runs on every re-import. Trusting the stored flag is simpler and can't disagree with it. `ctx` is kept in the signature for parity with the rest of `domain/plan/*`'s functions and in case a future rule needs it. |
| 4 | Task C-3: "Adding a matchup makes it the selected one," "removing the selected matchup selects a sensible neighbour" | Added `selectedMatchupId?: MatchupId` and `selectMatchup` to `WorkspaceState`, sibling to `status` — not part of `Workspace` and not zundo-undo-tracked | Selection is ephemeral UI state, not domain data to persist or undo — undoing a delete shouldn't fight with which matchup happens to be selected afterward. Matches how `status` was already carved out for the identical reason (SPEC-A). |
| 5 | Task C-4: drag handles **and** keyboard (Alt+↑/↓) for reorder | Drag implemented with native HTML5 `draggable`/`dragstart`/`dragover`/`drop` (no new dependency); keyboard is the fully-tested, guaranteed path | NFR-2.2 designates keyboard as the guaranteed-accessible path and drag as an enhancement — matching that priority, keyboard reorder is what the E2E suite exercises and what got the implementation rigor. A drag-and-drop library (dnd-kit, referenced for SPEC-D's sideboard planner in FR-8.8) would be the right investment when SPEC-D needs the same interaction anyway, not a one-off here. |
| 6 | Task C-5: "Confirmation dialog, then a toast" | The confirmation is an inline `role="alertdialog"` panel within the matchup's own list row, not a modal overlay | A full modal (focus trap, backdrop, portal) is disproportionate for a two-button "Delete X?" confirmation that's already scoped to one row. The inline panel still satisfies "requires confirmation" (FR-5.6) and is simpler to keep keyboard-reachable since it never moves focus away from the row. |
| 7 | Task C-7: "Reuses SPEC-A's import path verbatim... Do not fork it" | `ImportScreen` gained a `variant?: "workspace" \| "opponent"` prop (default `"workspace"`, byte-for-byte SPEC-A behaviour); `previewImport` gained a `validate?: boolean` option (default `true`) | The parsing/resolution pipeline (`parseDecklist`, `ScryfallCardRepository`, `previewImport`, `ParseSummary`, `UnresolvedNameCorrections`) is used completely unforked. Only the two things that must legitimately differ — the commit target (`workspace.deck` vs. `matchup.opponentDeck`) and whether FR-4 validation runs — are parameterized on one shared component, rather than copy-pasting a second import screen. |
| 8 | Task C-7: "Renders with the SPEC-B `DeckView` in a compact mode" | `DeckView` gained `deck?: Deck` and `compact?: boolean` props (both optional, default preserves exact SPEC-B behaviour) | Same reuse-not-fork principle as deviation 7, applied to the display side: compact mode hides the grouping/sort/layout controls and the statistics panel (not relevant for a read-only opponent-deck glance) but renders through the identical `DeckGrid`/`CardTile`/`CardDetail` pipeline. |
| 9 | C4 E2E spec: "Duplicating a split play/draw matchup copies both variants," "carries... per-card notes across" | Not covered at the E2E level — no UI exists yet to enable split play/draw or add a plan with per-card notes (both are SPEC-D surfaces: the sideboard planner) | Same dependency gap SPEC-A's A4 and SPEC-B's B2 test 6 had on specs that hadn't landed yet. Both properties are fully covered at the domain level (`matchup.test.ts`'s split-plan and per-note duplication tests) — this spec's E2E coverage is what's actually reachable through the browser today (name/copy, the aliasing assertion, tags/priority). Revisit once SPEC-D adds the planner UI. |
| 10 | C3 E2E spec test 2: "reload of the view preserves it [reorder]" | Tested as "switching the selected matchup and back doesn't disturb the order" instead of an actual page reload | There's no persistence layer yet (SPEC-E) and no routing (still a single page) — a real `page.reload()` would wipe all in-memory state, including the deck, and prove nothing. Switching selection exercises the same "the order isn't tied to which matchup is being viewed" property the spec's test is really checking. |
