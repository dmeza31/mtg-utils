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

- [ ] Grouping, sorting and statistics are pure functions with ≥ 90% branch coverage.
- [ ] An Artifact Creature groups under Creature, proven by test.
- [ ] Lands are excluded from the curve, proven by test.
- [ ] The deck view renders 75 cards with no layout shift as images load.
- [ ] Usable at 320 px with no horizontal scroll.
- [ ] Every chart has a text alternative.
- [ ] All four B-story E2E specs pass on chromium; B1 and B3 also pass on mobile.
