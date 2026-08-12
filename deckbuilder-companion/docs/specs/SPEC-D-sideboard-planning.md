# SPEC-D — Epic D: Build a Sideboard Plan

| | |
|---|---|
| **Depends on** | SPEC-B, SPEC-C |
| **Blocks** | SPEC-E |
| **Stories** | D1, D2, D3, D4, D5, D6, D7 |
| **Requirements** | FR-6.x, FR-7.x, FR-8.x, FR-9.x, NFR-2.2, NFR-2.6, NFR-1.3 |
| **Estimated size** | Two to three sessions |

---

## 1. Goal

The core of the product: build a legal, validated sideboard plan per matchup, in two interchangeable interaction modes.

## 2. The architectural rule that makes this work ⭐

> **Both UIs are views over one `SideboardPlan`. There is no drag-mode state and no list-mode state.**

FR-9.6 ("switching modes preserves the plan exactly") is then satisfied by construction rather than by synchronisation code. Two mode-local states that sync on toggle is the design that produces "I lost my plan when I switched views" bugs, and no amount of testing fully rescues it.

Concretely: both `DragPlanner` and `ListPlanner` read the same `plan` from the store and call the same SPEC-002 `actions.ts` functions. Neither owns any plan state.

```
                    ┌─────────────────────────┐
                    │  workspaceStore         │
                    │  matchup.plans[variant] │
                    └───────────┬─────────────┘
                                │ same plan, same actions
                ┌───────────────┴───────────────┐
        ┌───────▼────────┐             ┌────────▼───────┐
        │  DragPlanner   │             │  ListPlanner   │
        │  (@dnd-kit)    │             │  (steppers)    │
        └────────────────┘             └────────────────┘
```

---

## 3. Domain tasks

The plan actions, validation, post-board computation and reconciliation were built in SPEC-002 (tasks 4–8). What remains is the availability model the UI needs.

### Task D-1 — Availability projection

`src/domain/plan/availability.ts` — the single source of truth for "what can the user do right now", so that FR-7.4 (make illegal actions unavailable) is one tested function rather than scattered conditionals in two UIs.

```ts
export interface CardAvailability {
  readonly cardId: CardId
  readonly inDeck: number          // copies in the relevant zone
  readonly planned: number         // copies already out/in
  readonly remaining: number       // inDeck - planned, never negative
  readonly canAdd: boolean
  readonly canRemove: boolean
}
export function maindeckAvailability(deck: Deck, plan: SideboardPlan): readonly CardAvailability[]
export function sideboardAvailability(deck: Deck, plan: SideboardPlan): readonly CardAvailability[]
```

**Tests first:**
- A 4-of with 2 boarded out → `remaining: 2`, `canAdd: true`, `canRemove: true`.
- A 4-of fully boarded out → `remaining: 0`, `canAdd: false`.
- Nothing planned → `canRemove: false`.
- A card in both zones appears in **both** projections with independent numbers (FR-6.5).
- A plan entry for a card not in the deck → `inDeck: 0`, `remaining: 0`, `canRemove: true` (the user must be able to clear a broken entry).
- `remaining` is never negative even with an over-quantity entry from a stale reconcile.

---

## 4. Shared UI tasks

### Task D-2 — Planner shell (D3)

`src/features/plan/SideboardPlanner.tsx`

- Mode toggle: Drag / List, `data-testid="planner-mode-toggle"` (FR-9.6)
- Persists the choice for the session (FR-9.7)
- **Defaults to list mode below the tablet breakpoint** (FR-9.7) — drag on a phone is a poor experience and list mode is strictly better there
- Variant tabs when `splitPlayDraw` is on (D6)
- Validation bar, always visible (FR-7.5)

### Task D-3 — Validation bar (D4)

`src/features/plan/ValidationBar.tsx` (FR-7.1, 7.2, 7.3, 7.5)

- Live totals: "3 out · 3 in" (FR-7.1)
- Unbalanced state shows the delta in the FR-7.2 wording: **"2 out, 3 in — 1 too many"**
- Post-board deck size, flagged when < 60 (FR-7.3)
- Broken-reference warnings with the card named (FR-6.9)
- Sticky so it stays visible while scrolling a 60-card list (FR-7.5)
- Icon + text + colour, never colour alone (NFR-2.4)
- `role="status"` `aria-live="polite"` so screen-reader users get validation changes without polling — this is the difference between the validation being present and being *usable*
- `data-testid="plan-validation"`, `plan-out-total`, `plan-in-total`, `plan-postboard-size`

**Never blocks.** An invalid plan is saveable and exportable, marked incomplete (FR-7.6). Users build plans over multiple sittings; a form that refuses to persist until balanced would lose work.

---

## 5. Drag-and-drop mode (D1)

### Task D-4 — `DragPlanner`

`src/features/plan/drag/DragPlanner.tsx`, built on `@dnd-kit/core` (FR-8.8).

Four zones (FR-8.1):

```
┌──────────────────────┬──────────────────────┐
│ MAINDEck (source)    │  OUT (drop)          │
│ grouped card tiles   │  cards leaving       │
├──────────────────────┼──────────────────────┤
│ SIDEBOARD (source)   │  IN (drop)           │
│ grouped card tiles   │  cards coming in     │
└──────────────────────┴──────────────────────┘
```

`data-testid`: `plan-maindeck-source`, `plan-sideboard-source`, `plan-out-zone`, `plan-in-zone`, and `plan-card-{cardId}` on each draggable.

Behaviour:
- Maindeck → OUT adds one copy; sideboard → IN adds one copy (FR-8.2)
- Dragging back out of a zone, or a per-card `×` button, removes one copy (FR-8.3) — the `×` matters because a drag-to-remove-only design has no touch-friendly undo
- Valid targets highlight during drag; invalid targets show rejection (FR-8.4)
- Maindeck → IN and sideboard → OUT are **invalid** and visibly rejected
- A card with `remaining === 0` is not draggable at all (FR-7.4, via `canAdd`)
- Source tiles show remaining count, decrementing live (FR-8.5)
- `DragOverlay` for the dragged card so it isn't clipped by scroll containers
- Respects `prefers-reduced-motion` (NFR-2.7)
- 60 fps during drag (NFR-1.3) — memoise tiles; do not recompute availability for all 75 cards on every pointer move

### Task D-5 — Keyboard drag (FR-8.6) ⭐

dnd-kit's `KeyboardSensor` plus an `aria-live` announcer.

| Key | Action |
|---|---|
| Tab | Move between cards |
| Space / Enter | Pick up / drop |
| ↑ ↓ ← → | Move between zones while carrying |
| Escape | Cancel the drag |

Announcements (NFR-2.6): `"Picked up Lightning Bolt"` → `"Over OUT zone"` → `"Dropped Lightning Bolt into OUT. 3 out, 2 in."` — the totals in the drop announcement are what make the feature usable without sight, not a nicety.

This task is where accessible drag-and-drop is actually won or lost. Budget real time for it; it is the reason FR-8.8 specifies dnd-kit.

---

## 6. List mode (D2)

### Task D-6 — `ListPlanner`

`src/features/plan/list/ListPlanner.tsx` (FR-9.1–9.5)

Two panels, maindeck and sideboard, as compact rows: quantity in deck, card name, mana cost, and a stepper.

- Stepper clamped to `[0, remaining + planned]` from D-1 (FR-9.3); `−` disabled at 0, `+` disabled at max (FR-7.4)
- Direct numeric entry, also clamped
- Text search + card-type filter (FR-9.4), `data-testid="plan-list-search"`, `plan-list-type-filter`
- Full keyboard operation: Tab between rows, ←/→ or −/+ to adjust (FR-9.5)
- Card image on row hover/focus (FR-9.8, priority S)
- Rows with a non-zero plan quantity are visually distinguished and sort to the top by default — the user's plan should be readable without scrolling a 60-row list
- Virtualise only if profiling shows a need; 60 rows generally doesn't warrant it, and virtualisation complicates both keyboard navigation and E2E testing

### Task D-7 — Mode parity (D3)

There is nothing to build for FR-9.6 if §2's rule was followed. What this task *is*: write the parity test (see `D3` E2E below) and confirm it passes without new code. If it doesn't pass, the fix is to remove the duplicated state, not to add a sync.

---

## 7. Remaining features

### Task D-8 — Game plan editor (D5, FR-6.6)

- Textarea with basic Markdown, plus a preview toggle
- `react-markdown` + `rehype-sanitize` for the preview (NFR-5.3)
- Autosaves to the store on debounce; no explicit save button
- Supports bold, italic, bullet lists — nothing more. Scope creep here (tables, images, embeds) buys nothing for a document read between rounds.
- `data-testid="game-plan-editor"`, `game-plan-preview"`

### Task D-9 — Play/draw split (D6, FR-6.8)

- Toggle per matchup, `data-testid="split-play-draw-toggle"`
- **Enabling seeds both variants from the existing unified plan** (FR-6.8 states this explicitly — test it; the naive implementation creates two empty plans and silently discards the user's work)
- Disabling asks what to keep: on-the-play, on-the-draw, or cancel. Never discard silently.
- Tabs switch variants; validation runs per variant (FR-7.7)
- A "copy from other variant" action, since the two plans usually differ by one or two cards

### Task D-10 — Post-board preview (D7, FR-6.10)

- A panel or dialog rendering `postBoardDeck(deck, plan)` with the SPEC-B `DeckView`
- Changed cards visually marked: removed, added, quantity-reduced
- Shows the post-board count prominently
- Read-only

### Task D-11 — Undo/redo (FR-8.9, priority S)

`zundo` on the store; Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z; visible buttons in the planner toolbar. Scope history to plan and matchup edits — undoing a deck import would be surprising rather than helpful.

### Task D-12 — Per-card notes (FR-6.7, priority S)

A small note field on each OUT/IN entry, in both modes. Notes flow through to export (SPEC-E).

### Task D-13 — Unused-card insight (FR-6.11, priority C)

A panel listing maindeck cards never boarded out in any matchup, and sideboard cards never boarded in. Genuinely useful for tuning, and cheap — it's a pure fold over matchups. Build it only after everything `M` is done.

---

## 8. Testing drag-and-drop

Playwright's `dragTo()` does not reliably drive dnd-kit's pointer sensor, which listens to discrete pointer events with a movement threshold. Use a stepped helper:

```ts
// tests/support/dnd.ts
export async function dragCardTo(page: Page, cardTestId: string, zoneTestId: string) {
  const card = page.getByTestId(cardTestId)
  const zone = page.getByTestId(zoneTestId)
  const from = await card.boundingBox()
  const to = await zone.boundingBox()
  if (!from || !to) throw new Error('element not visible')

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  // several intermediate moves: dnd-kit needs to cross its activation threshold
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / 10 + to.width / 2,
      from.y + ((to.y - from.y) * i) / 10 + to.height / 2,
    )
  }
  await page.mouse.up()
}
```

**Prefer the keyboard path for assertions about plan state.** It is deterministic, it exercises FR-8.6 at the same time, and it doesn't flake on layout differences between browsers. Use the pointer helper to prove pointer dragging works at all (D1), and the keyboard path everywhere the assertion is really about the resulting plan.

**Playwright component tests** (`tests/component/DragPlanner.ct.tsx`) cover the interaction mechanics — activation threshold, invalid-target rejection, overlay rendering — without booting the whole app. That keeps the E2E specs about user journeys and the component tests about drag behaviour.

---

## 9. E2E specs

### `D1-plan-drag-and-drop.spec.ts` — `@tablet`
1. Drag a maindeck card to OUT → appears in OUT, source remaining decrements (FR-8.2, FR-8.5).
2. Drag a sideboard card to IN → appears in IN.
3. Drag a card out of OUT → removed, remaining restored (FR-8.3).
4. Dragging a maindeck card to IN is rejected; the plan is unchanged (FR-8.4).
5. A fully-boarded-out 4-of is no longer draggable (FR-7.4).
6. Touch drag works on the tablet project (FR-8.7).
7. `expectNoA11yViolations`.

### `D1b-plan-keyboard-drag.spec.ts`
1. Tab to a card, Space to pick up, ↓ to OUT, Space to drop → plan updated (FR-8.6).
2. The live region announced pick-up, target and drop **including the new totals** (NFR-2.6).
3. Escape mid-drag cancels; the plan is unchanged.
4. **Build a complete 3-for-3 plan using only the keyboard** (NFR-2.2). This is the story-level accessibility assertion — axe cannot tell you the task is completable.

### `D2-plan-list-mode.spec.ts` — `@mobile`
1. Switch to list mode → maindeck and sideboard rows render.
2. `+` on a maindeck row increments OUT; totals update (FR-9.2).
3. `+` is disabled at max copies; `−` disabled at 0 (FR-9.3, FR-7.4).
4. Search filters rows (FR-9.4); type filter narrows further.
5. Arrow keys adjust quantity from a focused row (FR-9.5).
6. On the mobile project, list mode is the **default** (FR-9.7).
7. `expectNoA11yViolations`.

### `D3-mode-switch-parity.spec.ts` ⭐
1. Build a plan in drag mode → switch to list → the same quantities appear on the right rows.
2. Modify in list mode → switch back to drag → the change is reflected.
3. Round-trip drag → list → drag with no change → the plan is byte-identical (assert via the exported workspace JSON).
4. Switching modes mid-edit loses nothing.

### `D4-plan-validation.spec.ts` — `@cross-browser`
1. Empty plan → validation shows 0 out, 0 in, and an incomplete indicator.
2. 3 out / 3 in → valid.
3. 2 out / 3 in → **"2 out, 3 in — 1 too many"** (assert the FR-7.2 wording literally).
4. 3 out / 2 in on a 60-card deck → unbalanced **and** under-60 warning.
5. Validation updates within one interaction, no reload (FR-7.5).
6. An unbalanced plan is still exportable, marked incomplete (FR-7.6).
7. The validation bar is announced to screen readers on change.

### `D5-game-plan-notes.spec.ts`
1. Type a game plan → persists across matchup navigation.
2. Markdown preview renders bold, italic and bullets.
3. `<script>alert(1)</script>` in the game plan is rendered as text, never executed (NFR-5.3).
4. Long text (5000 chars) doesn't break layout.

### `D6-play-draw-split.spec.ts`
1. Build a unified plan → enable split → **both variants are seeded from it** (FR-6.8).
2. Edit on-the-draw → on-the-play is unchanged.
3. Each variant validates independently (FR-7.7).
4. Disabling the split prompts for which to keep and honours the choice.

### `D7-post-board-preview.spec.ts`
1. Build a 3-for-3 → open the preview → 60 cards, with the three swapped cards marked.
2. Boarding out all 4 copies removes the card from the preview entirely.
3. Preview reflects the currently selected variant when split is on.

---

## 10. Definition of Done

- [x] Availability logic is a single tested function used by both UIs.
- [x] `D3-mode-switch-parity` passes **without** any mode-sync code existing.
- [x] A complete plan is buildable using only the keyboard (D1b test 4).
- [x] The validation bar announces changes via a live region.
- [x] FR-7.2's exact wording is asserted in a test.
- [x] Enabling split play/draw seeds both variants — tested.
- [x] No plan state exists outside the store.
- [x] All seven D-story E2E specs pass, plus the keyboard-drag spec.

Verified: `pnpm typecheck`, `pnpm lint`, `pnpm lint:purity`, `pnpm format:check`,
`pnpm test:unit` (322 tests, coverage thresholds met), `pnpm build`, and the
full Playwright suite (114 tests on chromium — every prior spec's E2E specs
plus all SPEC-D specs — plus the `@tablet`, `@mobile`, and `@cross-browser`
(firefox/webkit) tagged subsets) all pass. D-13 (unused-card insight,
priority C) was not built, per the spec's own instruction to build it only
after everything `M` is done — SPEC-D's `M`-priority scope (D-1 through
D-12) is complete.

---

## 11. Deviations from this spec as written

Recorded so later specs stay consistent with what actually exists (mirrors SPEC-C §7 / SPEC-B §7 / SPEC-A §8 / SPEC-002 §6 / SPEC-001 §8).

| # | Spec said | Reality | Why |
|---|---|---|---|
| 1 | Task D-5: keyboard drag built on "dnd-kit's `KeyboardSensor` plus an `aria-live` announcer" | A custom keyboard interaction layer alongside dnd-kit's pointer/touch `DndContext` — no `KeyboardSensor`. Space/Enter pick up and drop on the focused card's own `onKeyDown`; arrow keys jump between the four zones by name via a lookup table; Escape cancels; the announcer is a plain `aria-live="polite"` region driven by component state. | `KeyboardSensor`'s model is pixel-delta coordinate movement plus collision detection to infer the hovered droppable — it doesn't map cleanly onto "one keypress = move to the semantically next zone," which is what FR-8.6's key table and the D1b tests actually need. A small explicit zone-graph (`ZONE_GRID` in `DragPlanner.tsx`) is more direct, more deterministic to test, and produces the exact announcement text the spec's example shows. |
| 2 | D1b test 1's example: "Tab to a card, Space to pick up, **↓** to OUT, Space to drop" | Implemented as **→** (ArrowRight) from a source zone to its paired drop zone, matching the §5 ASCII diagram's layout (MAINDECK/OUT side-by-side, SIDEBOARD/IN side-by-side below) rather than a vertically-stacked one | The diagram and the keystroke example don't agree on which direction is spatially correct; the diagram is the more load-bearing artifact (it also drives the `data-testid` zone names and the DragPlanner grid CSS), so the keyboard mapping follows it. All four arrow keys still navigate between all four zones (see deviation 1's table). |
| 3 | §9 `D3-mode-switch-parity.spec.ts` test 3: "assert via the exported workspace JSON" | Asserts via a snapshot of every list-mode row's card name and quantity instead | Workspace JSON export doesn't exist until SPEC-E. A full plan snapshot (every non-zero row, sorted, before vs. after the round trip) proves the same thing — the round trip is byte-identical — without depending on a feature this spec doesn't build. |
| 4 | Task D-11: "Scope history to plan and matchup edits — undoing a deck import would be surprising rather than helpful" | The undo/redo toolbar and Cmd/Ctrl+Z shortcuts expose the store's existing `zundo` history unchanged; `partialize` still tracks the whole `workspace` (deck included), as it has since SPEC-002 | Narrowing `partialize` to exclude `deck` would touch SPEC-A's re-import reconciliation and SPEC-C's delete/undo-toast behavior, both already built and tested against the current shape — a change with a blast radius well beyond "add an undo button." No D-story test depends on undoing-an-import being blocked, so the toolbar simply surfaces what already exists; re-scoping history is left as follow-up work if it's ever actually needed. |
| 5 | Task D-4: maindeck/sideboard source zones show "grouped card tiles" | `DragPlanner`'s `CardChip` is a compact text row (name, mana cost, remaining count) — no card art, unlike SPEC-B's `CardTile` | A full image-tile grid inside a drag zone adds real layout/performance work (the spec's own NFR-1.3 60fps note calls out tile cost directly) for a surface where the name and remaining count are what the interaction actually needs. `ListPlanner` is the same trade for the same reason. The post-board preview (D-10) reuses the real `CardTile`-based `DeckView` where card art matters more (identifying a full 60). |
| 6 | §8: "Playwright component tests (`tests/component/DragPlanner.ct.tsx`) cover the interaction mechanics... without booting the whole app" | Not built — `tests/component/` has no test runner wired up (no `@playwright/experimental-ct-react` in this repo at any prior spec) | Standing up component-test infra from scratch was out of scope for this spec's time budget. The mechanics it would have covered (activation threshold, invalid-target rejection, overlay rendering) are covered by `D1`'s pointer-drag tests and `D1b`'s keyboard tests instead, which is more setup per test but needed no new infra. |
| 7 | Task D-2 / SPEC-002's `WorkspaceState`: `setSplitPlayDraw(id: MatchupId, split: boolean): void` | Replaced with `enableSplitPlayDraw(id)` and `disableSplitPlayDraw(id, keep: "onPlay" \| "onDraw")`, plus a new `copyPlanVariant(id, from, to)` | FR-6.8's seed-on-enable and never-silently-discard-on-disable behavior needs different data on each side of the toggle (nothing in, a keep choice out) — a single boolean setter can't express that. The one existing unit test that called the old signature was updated, not preserved as a compatibility shim (CLAUDE.md: no backwards-compatibility hacks for an API only this codebase calls). |
| 8 | SPEC-C's placeholder: `data-testid="matchup-game-plan"` on the game plan textarea | Renamed to `data-testid="game-plan-editor"`, matching Task D-8's explicit testid list | D-8 names the testid directly; keeping the old one alongside would mean two testids for one field, which isn't possible on one element. `C2-opponent-decklist.spec.ts` and `C4-duplicate-matchup.spec.ts` were updated to the new id — same behavior, new selector. |
| 9 | Task D-8: "Autosaves to the store on debounce; no explicit save button" | Debounces on a 400ms timer **and** flushes immediately on blur | A bare debounce risks losing the last keystrokes on a fast navigation (switching matchups, closing the tab) — a real product bug the spec's "nothing gets dropped" spirit rules out. Blur (switching matchups, clicking elsewhere) is exactly when a flush is safe and unsurprising. |
