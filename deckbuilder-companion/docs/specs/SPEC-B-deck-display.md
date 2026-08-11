# SPEC-B — Epic B: See the Deck

| | |
|---|---|
| **Depends on** | SPEC-A |
| **Blocks** | SPEC-D |
| **Stories** | B1, B2, B3, B4 |
| **Requirements** | FR-3.x, FR-2.7, FR-2.8, FR-2.9, NFR-1.2, NFR-2.3, NFR-3.2 |
| **Estimated size** | One to one and a half sessions |

---

## 1. Goal

A Moxfield-quality visual deck view: 75 cards as oldest-print artwork with quantity badges, groupable and sortable, with deck statistics — readable at 320 px and at 2560 px.

## 2. Design principle

**All grouping, sorting and statistics are pure domain functions.** The React components render arrays someone else computed. This means the interesting logic (how does a modal DFC get categorised? where does an X-cost spell sit on the curve?) is unit-tested at millisecond speed, and the components are dumb enough to be safe.

---

## 3. Domain tasks

### Task B-1 — Grouping

`src/domain/deck/group.ts` (FR-3.4)

```ts
export type GroupBy = 'type' | 'manaValue' | 'color' | 'none'
export interface CardGroup { readonly key: string; readonly label: string; readonly entries: readonly ResolvedEntry[] }
export function groupEntries(entries: readonly ResolvedEntry[], by: GroupBy): readonly CardGroup[]
```

Type grouping uses the conventional deckbuilding order, not alphabetical:

`Creature → Planeswalker → Instant → Sorcery → Artifact → Enchantment → Battle → Land`

Rules — each one a test:
- A card with multiple types takes its **first matching type in that order**. An Artifact Creature is a Creature; a Land Creature (Dryad Arbor) is a Creature. This is what players expect, and it's the rule most likely to be got wrong by naive `split(' ')` parsing.
- Modal DFCs (Agadeem's Awakening // Agadeem, the Undercrypt) group by the **front face**.
- Adventure cards group by the creature half.
- Split cards group by the front half's type.
- Empty groups are omitted, never rendered as empty headers.
- `'none'` returns exactly one group.

Colour grouping uses WUBRG order, with Multicolour and Colourless as their own buckets, by **colour identity** not mana cost (a deck view grouped by cast cost puts Devoid cards in the wrong place).

Mana value grouping buckets `0, 1, 2, 3, 4, 5, 6, 7+`. Lands are excluded from mana-value grouping entirely — a curve with 24 zero-drops is noise.

---

### Task B-2 — Sorting

`src/domain/deck/sort.ts` (FR-3.5)

```ts
export type SortBy = 'manaValue' | 'name' | 'quantity'
export function sortEntries(entries: readonly ResolvedEntry[], by: SortBy): readonly ResolvedEntry[]
```

- `manaValue` sorts ascending, tie-broken by name — so the order is **stable and deterministic**, not dependent on input order.
- `name` sorts with `Intl.Collator` so accented names (`Æther Vial`, `Lim-Dûl's Vault`) land where a player expects rather than after `Z`.
- `quantity` sorts descending, tie-broken by name.
- Sorting never mutates the input.

---

### Task B-3 — Statistics

`src/domain/deck/statistics.ts` (FR-3.8)

```ts
export interface DeckStatistics {
  readonly totalMaindeck: number
  readonly totalSideboard: number
  readonly manaCurve: readonly { manaValue: number; count: number }[]
  readonly colorPips: readonly { color: Color; count: number }[]
  readonly typeBreakdown: readonly { type: CardType; count: number }[]
  readonly landCount: number
  readonly averageManaValue: number
}
export function computeStatistics(deck: Deck, repo: CardRepository): DeckStatistics
```

The decisions worth testing explicitly, because reasonable people implement them differently:
- **Lands are excluded from the mana curve and from average mana value.** Include them and every deck's curve looks identical.
- **X counts as 0** in mana value (this is the rules-correct answer for a card not on the stack).
- **Pips are counted per copy**: 4 copies of a `{U}{U}` spell is 8 blue pips, not 2. Pip counts drive mana-base decisions, so per-copy is the only useful counting.
- **Hybrid pips** count toward both colours.
- **Generic mana is not a pip.**
- Split and modal cards count the front face for curve purposes, and are flagged in the type breakdown under the front face's type.
- An unresolved card is **excluded** from statistics rather than counted as 0 — a phantom zero-drop is worse than a slightly incomplete chart. Expose `unresolvedCount` so the UI can say so.

Table-test each rule with a hand-built deck. These are all pure functions over small inputs — this is the cheapest, highest-value test file in the project.

---

## 4. UI tasks

### Task B-4 — `CardTile` (B1)

`src/features/deck/CardTile.tsx`

- Oldest-print image from `card.imageUris.small` for grid tiles (FR-2.7)
- `loading="lazy"` (FR-2.8)
- Quantity badge, visible, high contrast (FR-3.1)
- `alt="{quantity}× {card.name}"` (NFR-2.3)
- Aspect ratio locked to 745:1040 (real card proportions) with a skeleton placeholder, so the grid doesn't reflow as images arrive
- Text-only fallback tile when the image is missing or the card is unresolved (FR-2.11)
- DFC flip control (FR-2.9) — a button, keyboard-operable, with the state announced
- `data-testid="card-tile"`, `data-card-name`, `data-quantity`

### Task B-5 — `DeckGrid` + `SideboardSection` (B1)

`src/features/deck/DeckView.tsx`

- Maindeck grid of grouped, sorted tiles with group headings that include per-group counts
- Sideboard in a visually distinct, labelled section (FR-3.2)
- Prominent totals: "Maindeck 60 · Sideboard 15" (FR-3.3)
- Responsive columns: 2 at 320 px → 8 at 2560 px (FR-3.9, NFR-3.2)
- Group headings are real `<h2>`/`<h3>` elements so screen-reader users can navigate by heading

### Task B-6 — Grouping and sorting controls (B2)

Two selects, `data-testid="deck-group-by"` / `deck-sort-by`. Defaults: group by type, sort by mana value (FR-3.4, FR-3.5). Choice persists in the session.

### Task B-7 — Stacked column layout (FR-3.6, priority S)

The Moxfield-style overlapping column view. Cards overlap vertically within a type column, showing each card's title bar with the full art of the last card visible.

- CSS negative margins, not absolute positioning — absolute positioning breaks keyboard focus scrolling.
- Hover/focus raises a card above its neighbours.
- **Every card must still be individually focusable and its name readable at the overlap offset.** Prettier is not worth unreachable.
- Falls back to grid below the tablet breakpoint.

### Task B-8 — Statistics panel (B3)

`src/features/deck/StatisticsPanel.tsx` — mana curve histogram, colour pip distribution, type breakdown.

- Each chart has an accessible text alternative: a visually hidden table with the same numbers (NFR-2.4). A histogram that only exists as coloured bars is unusable to a screen-reader user and to a colourblind user.
- `data-testid="stat-curve-bar"` with `data-mana-value` and `data-count` on each bar, so E2E asserts on numbers rather than pixel heights.
- Collapsible on mobile — it's secondary to the cards.
- No colour-only encoding; colour buckets carry their letter (W/U/B/R/G/C).

### Task B-9 — Card detail (B4)

`src/features/deck/CardDetail.tsx` (FR-3.7)

- Desktop: hover after a short delay shows a large-image popover
- Touch/click: a proper modal dialog — hover doesn't exist on touch, so tap must open something dismissible
- Shows `large` image (FR-2.7), full oracle text, mana cost, type line, and which zone(s) the card is in and at what quantity
- Radix Dialog for focus trap and Escape handling
- DFC: both faces reachable
- Keyboard: focus a tile, press Enter → detail opens; Escape → closes and focus returns to the tile it came from

---

## 5. E2E specs

### `B1-view-deck-images.spec.ts` — `@cross-browser`, `@mobile`
1. Import the Murktide fixture → 75 tiles rendered, maindeck and sideboard sections distinct.
2. Totals read "60" and "15" (FR-3.3).
3. A 4-of shows a quantity badge of 4 and appears as **one** tile, not four (FR-3.1).
4. Every tile image has non-empty alt text containing the card name (NFR-2.3).
5. Images below the fold carry `loading="lazy"` (FR-2.8).
6. At 320 px: no horizontal page scroll, tiles legible (FR-3.9, NFR-3.2).
7. A DFC tile flips and back via keyboard (FR-2.9).
8. An unresolved card renders a text fallback tile, not a broken image (FR-2.11).
9. `expectNoA11yViolations`.

### `B2-group-and-sort.spec.ts`
1. Default view is grouped by type in deckbuilding order — assert the heading sequence.
2. Group by mana value → headings are ascending numbers, lands absent.
3. Group by colour → WUBRG order with Multicolour and Colourless present.
4. Sort by name → tiles alphabetical within their group, `Æther Vial` collated correctly.
5. Sort by quantity → 4-ofs before 1-ofs.
6. Grouping choice survives navigating to a matchup and back.

### `B3-deck-statistics.spec.ts` — `@mobile`
1. Curve bars sum to the non-land maindeck count.
2. Land count matches the land cards in the fixture.
3. A 4× `{U}{U}` spell contributes 8 blue pips.
4. The hidden data table is present and matches the visible bars (NFR-2.4).
5. Panel collapses on mobile and reopens.

### `B4-card-detail.spec.ts`
1. Hover a tile on desktop → popover with the large image and oracle text.
2. Tap a tile on touch → modal dialog opens.
3. Escape closes it and focus returns to the originating tile.
4. Detail states the zone and quantity.
5. DFC detail exposes both faces.
6. `expectNoA11yViolations` with the dialog open — a focus-trap regression is silent otherwise.

---

## 6. Definition of Done

- [x] Grouping, sorting and statistics are pure functions with ≥ 90% branch coverage (92.4% aggregate across `src/domain/deck/**`).
- [x] An Artifact Creature groups under Creature, proven by test.
- [x] Lands are excluded from the curve, proven by test.
- [x] The deck view renders 75 cards with no layout shift as images load (aspect-locked tiles, SPEC-B §4 task B-4).
- [x] Usable at 320 px with no horizontal scroll.
- [x] Every chart has a text alternative.
- [x] All four B-story E2E specs pass on chromium; B1 and B3 also pass on mobile (plus a `@cross-browser` case on firefox/webkit).

## 7. Deviations from this spec as written

Recorded so later specs stay consistent with what actually exists (mirrors SPEC-A §8 / SPEC-002 §6 / SPEC-001 §8).

| # | Spec said | Reality | Why |
|---|---|---|---|
| 1 | Tasks B-1/B-2/B-3 operate on `ResolvedEntry` — type left implicit | `ResolvedEntry` and `resolveEntries(deck, zone, repo)` added to `src/domain/deck/queries.ts` (SPEC-002's existing deck-query module), not a new file | Every B-task needs "a `DeckEntry` joined with its resolved `Card`," and an entry whose card `peek()` misses is silently excluded (feeding `statistics.ts`'s `unresolvedCount`). One well-tested join function is cheaper than three call sites re-deriving it slightly differently. |
| 2 | Task B-3's `typeBreakdown: readonly { type: CardType; count: number }[]` — `CardType` left undefined | `CardType` (`"Creature" \| "Planeswalker" \| ... \| "Land" \| "Other"`) and a `cardType(card)` categoriser are defined once in `group.ts` and imported by `statistics.ts` | The spec's own words tie them together: "flagged in the type breakdown under the front face's type" is *the same rule* as B-1's grouping (front-face type-line, priority order). Two independent implementations of that rule would drift the moment someone added a new type bucket. |
| 3 | B-3: "Split and modal cards count the front face for curve purposes" | A small `manaValueFromCost(manaCost)` parser (generic numbers, `X`/`Y`/`Z` → 0, `N/color` twobrid → `N`, everything else → 1 pip) is used **only** when a front face has its own `manaCost`; ordinary cards still use `card.manaValue` directly | Scryfall's own top-level `cmc` for a split card is the *sum of both halves* (current comprehensive rules), and for MDFCs already happens to equal the front face — trusting `card.manaValue` uniformly would silently violate the spec's explicit front-face-only rule for split cards. Re-deriving from the front face's cost string is the only way to honor "front face only" as a deliberate simplification rather than an accident of Scryfall's data model. |
| 4 | Task B-6: "Choice persists in the session" | Group-by/sort-by/layout state lives in a new `DeckViewPreferencesProvider` (`src/features/deck/DeckViewPreferences.tsx`), mounted once at the root layout alongside `WorkspaceProvider`, rather than as `DeckView`'s own `useState` | "Survives navigating to a matchup and back" (B2 E2E test 6) requires state that outlives `DeckView` unmounting — a `useState` inside `DeckView` itself would reset on remount. Matchup navigation doesn't exist yet (SPEC-C), so this can't be proven end-to-end today, but the provider is already structured so it will be true once SPEC-C adds it, rather than needing a rework then. |
| 5 | B-9: Radix Dialog named explicitly; hover-popover behaviour ("hover after a short delay") left unspecified as to mechanism | Added `@radix-ui/react-hover-card` alongside `@radix-ui/react-dialog` | `HoverCard`'s built-in `openDelay` is exactly "hover after a short delay shows a popover" — reimplementing delayed-hover-with-correct-positioning-and-dismissal by hand would be reinventing what the library already solves, for a worse result. |
| 6 | — | `CardDetail`'s trigger is a `role="button"` `<div>`, not a real `<button>`, with `onKeyDown` guarded by `event.target !== event.currentTarget` | `CardTile` renders its own flip `<button>` for DFCs; wrapping it in a real `<button>` trigger would be an invalid `<button>`-in-`<button>` nesting. Found the guard was *necessary*, not optional, by testing in a real browser: without it, a bubbled Enter keydown from the focused flip button reached the outer trigger's handler, which called `preventDefault()` and silently cancelled the flip button's own native "Enter activates the focused button" behaviour — the flip button was clickable but not keyboard-operable. |
| 7 | — | `sr-only` accessible data tables (statistics panel) are wrapped in an `sr-only` **div**, not applied to the `<table>` element directly | Found via the 320px E2E test, not by inspection: a `<table>` with `sr-only`'s `width: 1px` still computes a much larger *rendered* layout box, because table auto-layout expands to fit cell content (`white-space: nowrap`) regardless of a declared small width — and that box counted toward `document.scrollWidth` even though `overflow: hidden` visually clipped it. Wrapping in a div (whose `width: 1px` **is** respected for a non-table element) fixes it; this is a documented general gotcha with `sr-only` on tables, not specific to this codebase. |
| 8 | — | The native `<input type="file">` in `ImportScreen` (built in SPEC-A) now carries `min-w-0 max-w-full` | Also found via the 320px E2E test: a file input's "Choose File" button + filename has an intrinsic content width that a flex child refuses to shrink below (the flex default `min-width: auto`), overflowing at 320px regardless of its container's own width. Invisible in SPEC-A because SPEC-A had no 320px test; surfaced now because `page.tsx` renders `ImportScreen` on every page including the deck view, and B1's 320px test exercises that combined layout. Fixed at the source rather than only in the SPEC-B page, since the bug lives in SPEC-A's component. |
| 9 | `page.tsx` behaviour left to SPEC-B ("deck display... replaces the placeholder-free page SPEC-A left") | `ImportScreen` renders unconditionally on every state (not hidden once a deck exists); `DeckView` renders additionally below it once `workspace.deck` is defined | First attempt hid `ImportScreen` behind an "Import a different deck" toggle once a deck existed — this broke three already-passing SPEC-A E2E tests (A1's re-import-zero-requests test, A3, A4), which interact with the textarea and confirm button directly after a prior import with no toggle-click step. SPEC-A's contract wins: the import screen must always be reachable without an extra click. |
| 10 | `page.tsx` main content width inherited from the root layout (SPEC-000's `max-w-7xl` on `<main>`, sized for placeholder body text) | `DeckView` renders as a sibling outside the intro's `max-w-2xl` column, but is still capped by the root layout's `max-w-7xl` (1280px) | The B-5 grid's responsive breakpoints target up to `min-[2200px]:grid-cols-8`, but the shared root layout (used by every page, present and future) caps content width at 1280px, so 8 columns are never actually reached on real hardware today. NFR-3.2 ("functional from 320px to 2560px") is satisfied literally — no horizontal scroll, everything usable and legible at any width in that range — just not at maximum density on ultra-wide monitors. Loosening the root layout's width cap is a cross-cutting change deferred to whichever spec first needs a genuinely full-width view. |
| 11 | B2 E2E test 6: "Grouping choice survives navigating to a matchup and back" | Not implemented as an E2E test — no matchup exists to navigate to (SPEC-C) | Same dependency gap as SPEC-A's A4 spec had on SPEC-C/D. The provider architecture (deviation 4) is already built so this will hold once matchup navigation exists; add the E2E assertion then. |
| 12 | B4 story implies detail is reachable from any deck-view surface | Card detail (hover popover + click dialog) is wired into `DeckGrid`'s tile rendering (both grid and stacked layouts), not into a separate detail-only surface | The spec doesn't describe a separate detail trigger surface — every rendered tile *is* the trigger, matching "hovering (desktop) or tapping (touch) a card" (FR-3.7) reading naturally as "the card you're already looking at in the grid." |
