# Deckbuilder Companion — Requirements

| | |
|---|---|
| **Document** | Product & Technical Requirements |
| **Version** | 1.0 (Draft) |
| **Date** | 2026-08-04 |
| **Status** | For review |
| **Owner** | Daniel Meza |
| **Scope** | v1 (MVP) with explicit forward-compatibility for v2+ |

---

## 1. Product Overview

### 1.1 Problem

Competitive Magic: The Gathering is won and lost in games 2 and 3. A player who has done the work knows, for every deck they expect to face, exactly which cards come out and which come in — and why. Today that work lives in a Google Doc, a Discord message, or someone's head. It is unstructured, easy to get wrong (boarding 4 out and 3 in, or bringing in a card that isn't in the sideboard), and painful to reference between rounds at a tournament.

### 1.2 Solution

A web application that takes a decklist in MTGO format, renders it visually (Moxfield-style card imagery), and lets the player build a **sideboard plan per expected matchup** — using either drag-and-drop or list selection — then export the whole set of plans as a single printable/phone-readable document to carry to the tournament.

### 1.3 Product Principles

| # | Principle | Implication |
|---|---|---|
| P1 | **Zero friction to first value** | No account, no install, no setup. Paste a decklist → see the deck. Under 10 seconds. |
| P2 | **The export is the product** | Everything in the app exists to produce a reference document that is genuinely usable in round 3 of a tournament with 4 minutes on the clock. |
| P3 | **The tool prevents illegal plans** | The app knows a sideboard plan must be balanced and must draw only from cards the player actually owns in the 75. It surfaces violations, always. |
| P4 | **Stateless now, stateful later** | v1 persists nothing server-side, but every domain model, boundary, and interface is designed so that adding accounts and a database is additive, not a rewrite. |
| P5 | **Respect the data sources** | Scryfall and Wizards of the Coast have terms. The app honours rate limits, caches aggressively, and attributes correctly. For Pictures use always oldest print|

---

## 2. Decisions Already Made

These were confirmed with the product owner and are treated as fixed inputs, not open questions.

| ID | Decision | Rationale |
|---|---|---|
| D-1 | **Stack: Next.js (App Router) + TypeScript** | Starts as a fully client-side stateless app, but provides route handlers, server components, auth integration and a data layer when v2 needs persistence — no rewrite. |
| D-2 | **Card data: Scryfall REST API, live with client-side caching** | Always current with new sets; no bulk dataset to build, ship or refresh. Cached in memory + `localStorage` to stay well inside rate limits. |
| D-3 | **Formats: 60-card constructed only for v1** (Standard, Pioneer, Modern, Legacy, Vintage, Pauper) | This is the segment where sideboard planning is the core activity. Limited and Commander are deferred (see §12). |
| D-4 | **Export: single "binder" document** — deck summary followed by one section per matchup | One artifact to print, AirDrop or open on a phone. Available as both Markdown and PDF. |
| D-5 | **v1 has no server-side persistence** | Confirmed by product owner. See R-1 in §11 for the one deliberate exception (local crash-recovery), and §10.3 for the migration path. |
| D-6 | **Artwork: always the oldest paper printing** | Per P5. Gives the deck one consistent visual identity regardless of how the list was exported. Set codes in an imported list are parsed and retained, but never drive artwork selection. |

---

## 3. Scope

### 3.1 In Scope (v1)

- Decklist import via paste, `.txt`/`.dek` file upload, and drag-and-drop of a file
- MTGO decklist parsing, with tolerance for the common near-miss formats players actually paste
- Card resolution and imagery via Scryfall
- Visual deck display (maindeck + sideboard) with grouping, sorting and deck statistics
- Creation and management of multiple **matchups**
- Per-matchup **game plan** free-text notes
- Per-matchup **sideboard plan** (cards OUT / cards IN), with two interaction modes: drag-and-drop and list-based selection
- Real-time validation of sideboard plan legality
- Optional separate plans for **on the play** vs **on the draw**
- Export of the full binder to Markdown and PDF
- Workspace export/import as a JSON file (portable "save file" without a backend)
- Responsive layout: desktop-first for building, mobile-readable for reference

### 3.2 Out of Scope (v1)

- User accounts, authentication, cloud sync
- Server-side persistence of any kind
- Deck *building* features: card search, adding/removing cards, price data, deck legality against a banned list
- Commander, Limited, and other non-60-card formats
- Playtesting, goldfishing, or simulated draws
- Importing decklists from Moxfield / Archidekt / MTGGoldfish URLs
- Sharing links, collaboration, or public plan galleries
- Metagame data or automatic matchup suggestions
- Native mobile apps

---

## 4. Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Competitive Grinder** (primary) | Plays weekly RCQs/Modern events with a tuned list. Knows their deck deeply. | Fast entry of an existing list; a rigorous, legal plan per matchup; a printed sheet in their deckbox. |
| **Returning Player** (secondary) | Comes back for a season, plays a netdeck, doesn't yet know the boarding. | Visual deck they can learn from; a place to write down advice they got; something to reference because they *don't* have it memorised. |
| **Deck Tuner** (secondary) | Iterates on a list weekly, testing sideboard configurations. | Re-import an updated list and keep existing matchup plans intact where cards still exist; see which plans broke. |

---

## 5. Glossary

| Term | Definition |
|---|---|
| **Maindeck** | The primary deck used for game 1. Minimum 60 cards in constructed. |
| **Sideboard** | Up to 15 additional cards, available to swap in for games 2 and 3. |
| **The 75** | Maindeck + sideboard combined. |
| **Matchup** | An opposing deck archetype the player expects to face. |
| **Sideboard plan** | For a given matchup: the set of cards taken OUT of the maindeck and the set brought IN from the sideboard. |
| **Balanced plan** | A plan where the count of cards OUT equals the count of cards IN, so post-board deck size is preserved. |
| **On the play / on the draw** | Whether the player goes first. Frequently changes the correct plan. |
| **Post-board deck** | The resulting deck after a plan is applied. |
| **Binder** | The exported document containing the deck and all matchup plans. |

---

## 6. User Stories

### Epic A — Import a deck
- **A1** As a player, I paste my MTGO decklist so the app can show me my deck.
- **A2** As a player, I upload a `.txt` or `.dek` file exported from MTGO instead of pasting.
- **A3** As a player, when a card name doesn't resolve, I see exactly which line failed and can correct it inline without re-pasting the whole list.
- **A4** As a deck tuner, I re-import an updated list and keep my existing matchup plans, being told which plans are now invalid.

### Epic B — See the deck
- **B1** As a player, I see every card as its real card image with a quantity badge, maindeck and sideboard clearly separated.
- **B2** As a player, I group and sort the deck (by type, mana value, colour, name) to read it the way I think about it.
- **B3** As a player, I see deck statistics — total counts, mana curve, colour distribution, type breakdown — so I can sanity-check the list.
- **B4** As a player, I hover or tap a card to see its full oracle text at readable size.

### Epic C — Manage matchups
- **C1** As a player, I add a matchup by naming the archetype (e.g. "Izzet Murktide").
- **C2** As a player, I optionally paste the opponent's decklist so I can see their threats while planning.
- **C3** As a player, I rename, reorder, duplicate and delete matchups.
- **C4** As a player, I duplicate a matchup plan as a starting point for a similar deck.

### Epic D — Build a sideboard plan
- **D1** As a player, I drag cards from my maindeck into an "OUT" zone and cards from my sideboard into an "IN" zone.
- **D2** As a player, I instead use a list view with +/− steppers to set how many copies go out and in — faster for keyboard users and on mobile.
- **D3** As a player, I switch freely between drag-and-drop and list mode; both edit the same plan.
- **D4** As a player, I'm warned immediately when my plan is unbalanced, exceeds available copies, or leaves me under 60 cards.
- **D5** As a player, I write a game plan for the matchup — what my role is, what to watch for, key interactions.
- **D6** As a player, I optionally split the plan into "on the play" and "on the draw" variants.
- **D7** As a player, I see the resulting post-board deck so I can confirm it's what I intended.

### Epic E — Export and carry
- **E1** As a player, I export all my matchup plans as one PDF I can print and put in my deckbox.
- **E2** As a player, I export as Markdown to paste into my notes app or a Discord message.
- **E3** As a player, I open the export on my phone between rounds and read it without pinching or scrolling sideways.
- **E4** As a player, I save my whole workspace to a file and reload it next week without re-entering everything.

---

## 7. Functional Requirements

Priorities use MoSCoW: **M** = Must have (v1), **S** = Should have (v1 if time permits), **C** = Could have, **W** = Won't have this release.

### FR-1 — Decklist Import

| ID | Priority | Requirement |
|---|---|---|
| FR-1.1 | M | The app SHALL accept a decklist pasted into a multi-line text area. |
| FR-1.2 | M | The app SHALL accept a decklist uploaded as a `.txt` file, via file picker or drag-and-drop onto the import area. |
| FR-1.3 | S | The app SHALL accept MTGO `.dek` files (XML), extracting card names, quantities and sideboard flags. |
| FR-1.4 | M | Parsing SHALL be performed entirely client-side. |
| FR-1.5 | M | The app SHALL display a parse summary before committing: maindeck count, sideboard count, unrecognised lines, ambiguous names. |
| FR-1.6 | M | The app SHALL allow the user to replace the current deck with a newly imported one, warning that matchup plans may be affected (see FR-6.9). |

#### FR-1.7 — Accepted Decklist Grammar (M)

The parser SHALL accept the canonical MTGO plain-text export and the variants below. Each is a real format that players copy from real tools; rejecting them would break P1.

| Variant | Example | Sideboard delimiter |
|---|---|---|
| MTGO plain text | `4 Lightning Bolt` | One or more blank lines |
| Header-delimited | `Deck` … `Sideboard` | Literal `Sideboard` / `Sideboard:` header |
| Magic Workstation | `SB: 3 Chalice of the Void` | `SB:` line prefix |
| Arena-style with set codes | `4 Lightning Bolt (2XM) 129` | `Deck` / `Sideboard` headers |
| Quantity with `x` | `4x Lightning Bolt` | any of the above |

Additional parsing rules:

| ID | Priority | Requirement |
|---|---|---|
| FR-1.7.1 | M | Leading/trailing whitespace and `\r\n` line endings SHALL be normalised. |
| FR-1.7.2 | M | Lines beginning with `//` or `#` SHALL be treated as comments and ignored. |
| FR-1.7.3 | M | Empty lines SHALL be treated as a sideboard delimiter **only** when no explicit header or `SB:` prefix is present anywhere in the list. |
| FR-1.7.4 | M | Split, adventure and modal double-faced cards SHALL be accepted in both full (`Fire // Ice`) and front-face-only (`Fire`) forms. |
| FR-1.7.5 | M | A missing quantity SHALL default to 1. |
| FR-1.7.6 | M | Set code and collector number, when present, SHALL be captured and retained on the deck entry for round-trip fidelity and name disambiguation, but SHALL NOT determine which printing's artwork is displayed — see D-6 and FR-2.13. A set code that cannot be resolved SHALL NOT fail the line. |
| FR-1.7.7 | M | Duplicate entries of the same card in the same zone SHALL be merged, summing quantities. |
| FR-1.7.8 | S | Accented and special characters (e.g. `Lim-Dûl's Vault`, `Æther Vial`) SHALL resolve correctly, including when the user pastes an unaccented approximation. |

### FR-2 — Card Data Resolution

| ID | Priority | Requirement |
|---|---|---|
| FR-2.1 | M | Card data SHALL be resolved from the Scryfall API. |
| FR-2.2 | M | Resolution SHALL use the batch collection endpoint, chunking requests to the API's documented maximum identifiers per call, to minimise request count. |
| FR-2.3 | M | The client SHALL rate-limit outbound Scryfall requests to no more than 10 requests/second with a minimum ~100 ms delay between calls, per Scryfall's published guidance. |
| FR-2.4 | M | The client SHALL send a descriptive `User-Agent` and `Accept: application/json` on every Scryfall request. |
| FR-2.5 | M | Resolved card data SHALL be cached in memory for the session and in `localStorage` across sessions, keyed by card identity, with a TTL of no less than 7 days. |
| FR-2.6 | M | A cache hit SHALL NOT produce a network request. |
| FR-2.7 | M | Card images SHALL be loaded from Scryfall-hosted image URIs at an appropriate size for the viewport (`small` for grid tiles, `normal`/`large` for detail views). |
| FR-2.8 | M | Images SHALL be lazy-loaded below the fold. |
| FR-2.9 | M | Double-faced cards SHALL expose both faces, with a flip affordance in the UI. |
| FR-2.10 | M | Unresolvable card names SHALL be surfaced with the offending line, a reason, and — where Scryfall offers one — a "did you mean" suggestion the user can accept with one click. |
| FR-2.11 | M | A failed or rate-limited Scryfall request SHALL be retried with exponential backoff, and the app SHALL degrade to a text-only card representation rather than blocking, if resolution ultimately fails. |
| FR-2.12 | M | The following fields SHALL be captured per card: oracle name, mana cost, mana value, type line, oracle text, colours, colour identity, rarity, set, collector number, image URIs, layout, and card faces. |
| FR-2.13 | M | Artwork SHALL always be that of the card's **oldest paper printing** by release date, per D-6, regardless of any set code present in the imported list. |
| FR-2.14 | M | Oldest-printing selection SHALL be governed by an explicit, isolated **printing policy**: paper printings only (excluding digital-only releases), excluding non-tournament novelty products, and — where two printings share a release date — resolved by a deterministic tiebreak so the same card always yields the same artwork. |
| FR-2.15 | M | Oldest-printing resolution SHALL be batched, not one request per card, to satisfy NFR-1.2 and FR-2.3. |
| FR-2.16 | M | If oldest-printing resolution fails for a card, the app SHALL fall back to Scryfall's default printing artwork rather than rendering no image. |

### FR-3 — Deck Display

| ID | Priority | Requirement |
|---|---|---|
| FR-3.1 | M | The maindeck SHALL be displayed as a grid of card images with a visible quantity badge on each card. |
| FR-3.2 | M | The sideboard SHALL be displayed in a visually distinct, clearly labelled section. |
| FR-3.3 | M | Total maindeck and sideboard counts SHALL be displayed prominently. |
| FR-3.4 | M | Cards SHALL be groupable by: card type (default), mana value, colour, and ungrouped. |
| FR-3.5 | M | Within a group, cards SHALL be sortable by mana value (default), name, and quantity. |
| FR-3.6 | S | A stacked/fanned column layout (Moxfield-style, cards overlapping vertically within a type column) SHALL be available in addition to the flat grid. |
| FR-3.7 | M | Hovering (desktop) or tapping (touch) a card SHALL open a detail view with the full-size image and oracle text. |
| FR-3.8 | S | The app SHALL display deck statistics: mana curve histogram, colour pip distribution, and card type breakdown. |
| FR-3.9 | M | The deck view SHALL remain usable at 320 px width. |
| FR-3.10 | C | A compact text-list view of the deck SHALL be available as an alternative to the visual view. |

### FR-4 — Deck Validation

Validation is **advisory** in v1 — it informs, it never blocks. Banned/restricted list enforcement is explicitly out of scope.

| ID | Priority | Requirement |
|---|---|---|
| FR-4.1 | M | The app SHALL warn when the maindeck contains fewer than 60 cards. |
| FR-4.2 | M | The app SHALL warn when the sideboard exceeds 15 cards. |
| FR-4.3 | S | The app SHALL warn when any non-basic-land card appears more than 4 times across the 75, excluding cards whose oracle text permits any number (e.g. Relentless Rats, Dragon's Approach, Persistent Petitioners) and cards with an explicit deck limit in their oracle text (e.g. Seven Dwarves, Nazgûl). |
| FR-4.4 | M | Warnings SHALL be dismissible and SHALL NOT prevent the user from proceeding to sideboard planning. |
| FR-4.5 | W | The app SHALL NOT validate against format banned/restricted lists in v1. |

### FR-5 — Matchup Management

| ID | Priority | Requirement |
|---|---|---|
| FR-5.1 | M | The user SHALL be able to create an unlimited number of matchups. |
| FR-5.2 | M | Each matchup SHALL have a required name (archetype). |
| FR-5.3 | S | Each matchup MAY have an optional opponent decklist, imported through the same parser as FR-1. |
| FR-5.4 | S | Each matchup MAY have optional metadata: expected frequency/priority (high/medium/low), and free-text tags. |
| FR-5.5 | M | The user SHALL be able to rename, duplicate, reorder, and delete matchups. |
| FR-5.6 | M | Deleting a matchup SHALL require confirmation and SHALL be undoable for the remainder of the session. |
| FR-5.7 | M | Matchups SHALL be presented as a navigable list/sidebar with an at-a-glance validity indicator per matchup (valid / unbalanced / incomplete). |
| FR-5.8 | S | When an opponent decklist is present, the planning view SHALL display it alongside the plan so the user can see what they're playing against. |

### FR-6 — Sideboard Plan

| ID | Priority | Requirement |
|---|---|---|
| FR-6.1 | M | Each matchup SHALL have a sideboard plan consisting of an **OUT** set (cards removed from the maindeck) and an **IN** set (cards added from the sideboard). |
| FR-6.2 | M | Each entry in the OUT/IN sets SHALL reference a card and a quantity. |
| FR-6.3 | M | Quantity OUT for a card SHALL NOT exceed the copies of that card in the maindeck. |
| FR-6.4 | M | Quantity IN for a card SHALL NOT exceed the copies of that card in the sideboard. |
| FR-6.5 | S | A card present in **both** maindeck and sideboard SHALL be handled correctly: it may be brought IN up to its sideboard count, and taken OUT up to its maindeck count, independently. |
| FR-6.6 | M | Each matchup SHALL have a free-text **game plan** field supporting multi-line text and basic Markdown (bold, italic, bullet lists). |
| FR-6.7 | S | Each plan entry MAY carry a short per-card note (e.g. "only on the draw", "first copy is fine"). |
| FR-6.8 | S | The user SHALL be able to enable **split plans** for a matchup, producing separate OUT/IN sets for *on the play* and *on the draw*. When disabled, a single plan applies to both. Enabling the split SHALL seed both variants from the existing single plan. |
| FR-6.9 | M | When the deck is re-imported, existing plans SHALL be preserved for cards that still exist in the 75 at sufficient quantity; entries that no longer resolve SHALL be flagged as broken on the affected matchups, not silently dropped. |
| FR-6.10 | S | The user SHALL be able to preview the resulting **post-board deck** for a matchup. |
| FR-6.11 | C | The app SHALL surface cards that are never boarded out across any matchup, and sideboard cards never boarded in — a useful signal for deck tuning. |

### FR-7 — Sideboard Plan Validation

| ID | Priority | Requirement |
|---|---|---|
| FR-7.1 | M | The app SHALL compute and display, live, the total OUT count and total IN count for the active plan. |
| FR-7.2 | M | The app SHALL flag a plan as **unbalanced** when total OUT ≠ total IN, showing the delta (e.g. "2 out, 3 in — 1 too many"). |
| FR-7.3 | M | The app SHALL flag when the post-board maindeck would fall below 60 cards. |
| FR-7.4 | M | The app SHALL prevent, at the interaction level, exceeding available copies (FR-6.3 / FR-6.4) — the UI SHALL make the illegal action unavailable rather than allowing it and erroring afterward. |
| FR-7.5 | M | Validation state SHALL be visible without leaving the planning view. |
| FR-7.6 | M | An invalid plan SHALL still be saveable and exportable, clearly marked as incomplete — a work-in-progress plan must not be lost. |
| FR-7.7 | S | Validation SHALL run per-variant when split play/draw plans are enabled. |

### FR-8 — Planning UI: Drag and Drop Mode

| ID | Priority | Requirement |
|---|---|---|
| FR-8.1 | M | The planning view SHALL offer a drag-and-drop mode with at minimum: a maindeck source zone, a sideboard source zone, an OUT drop zone, and an IN drop zone. |
| FR-8.2 | M | Dragging a card from the maindeck to the OUT zone SHALL add one copy to the OUT set; dragging from the sideboard to the IN zone SHALL add one copy to the IN set. |
| FR-8.3 | M | Dragging a card out of the OUT/IN zone (or a per-card remove control) SHALL remove one copy. |
| FR-8.4 | M | Valid drop targets SHALL be visually highlighted during a drag; invalid targets SHALL be visibly rejected. |
| FR-8.5 | M | Source cards SHALL show remaining-available quantity, decrementing as copies are moved. |
| FR-8.6 | M | Drag-and-drop SHALL be keyboard accessible: cards SHALL be focusable, and a keyboard-initiated move SHALL be possible with screen-reader announcements of pick-up, target and drop. |
| FR-8.7 | M | Drag-and-drop SHALL work with touch input on tablet-sized viewports. |
| FR-8.8 | S | The interaction SHALL be built on an accessibility-supporting drag library (e.g. dnd-kit) rather than raw HTML5 drag events, which have poor touch and screen-reader support. |
| FR-8.9 | S | An undo/redo stack SHALL cover plan edits within a session. |

### FR-9 — Planning UI: List Mode

| ID | Priority | Requirement |
|---|---|---|
| FR-9.1 | M | The planning view SHALL offer a list mode presenting the maindeck and sideboard as compact rows. |
| FR-9.2 | M | Each maindeck row SHALL provide a stepper (−/+) or quantity input for copies OUT; each sideboard row the same for copies IN. |
| FR-9.3 | M | Steppers SHALL be clamped to the legal range [0, available copies]. |
| FR-9.4 | M | Rows SHALL be filterable by a text search and by card type. |
| FR-9.5 | M | The list SHALL be fully keyboard-operable, with a sensible tab order and arrow-key quantity adjustment. |
| FR-9.6 | M | Switching between drag-and-drop and list mode SHALL preserve the plan exactly — both modes are views over one shared plan model, not separate states. |
| FR-9.7 | M | The mode toggle SHALL be persistent within the session and SHALL default to list mode on viewports narrower than the tablet breakpoint. |
| FR-9.8 | S | The list SHALL show each row's card image on hover/focus so users can plan without memorising names. |

### FR-10 — Export

| ID | Priority | Requirement |
|---|---|---|
| FR-10.1 | M | The app SHALL export a **binder** document containing: a title/header block, a deck summary (maindeck and sideboard as text lists with counts), and one section per matchup. |
| FR-10.2 | M | Each matchup section SHALL contain: matchup name, game plan text, cards OUT (with quantities), cards IN (with quantities), the OUT/IN totals, and per-card notes if present. |
| FR-10.3 | M | Matchups with split play/draw plans SHALL render both variants, clearly labelled. |
| FR-10.4 | M | Export SHALL be available as **Markdown** (`.md`), generated client-side and downloaded as a file. |
| FR-10.5 | M | Export SHALL be available as **PDF**, generated client-side. |
| FR-10.6 | M | The PDF SHALL be paginated so that no matchup section is split across a page boundary where it fits on one page. |
| FR-10.7 | M | The PDF SHALL be legible when printed in black and white — information SHALL NOT be conveyed by colour alone. |
| FR-10.8 | M | The PDF SHALL be readable on a phone screen: a single-column layout, body text at an effective size no smaller than 10 pt. |
| FR-10.9 | S | The export SHALL be previewable in-app before download. |
| FR-10.10 | S | The user SHALL be able to select which matchups to include in the export. |
| FR-10.11 | C | The PDF MAY optionally include small card thumbnails alongside OUT/IN entries; this SHALL be off by default to keep file size and print cost low. |
| FR-10.12 | M | Export SHALL succeed with no network access, using only already-cached data. |
| FR-10.13 | M | Exported documents SHALL carry the required Scryfall/WotC attribution (see NFR-7). |

### FR-11 — Workspace Portability

Consistent with D-5, this is **file-based**, not server persistence.

| ID | Priority | Requirement |
|---|---|---|
| FR-11.1 | S | The user SHALL be able to export the entire workspace (deck + all matchups + plans + notes) as a single versioned JSON file. |
| FR-11.2 | S | The user SHALL be able to import such a JSON file to restore a workspace. |
| FR-11.3 | S | The JSON SHALL include a schema version to permit forward migration. |
| FR-11.4 | M | The app SHALL autosave the working state to `localStorage` and offer to restore it on next load. **Rationale:** an accidental refresh destroying an hour of sideboard planning is the single most likely reason a user abandons the tool. This is browser-local only and introduces no backend, so it does not conflict with D-5. |
| FR-11.5 | M | The user SHALL be able to clear all local state from within the app. |

---

## 8. Non-Functional Requirements

### NFR-1 — Performance

| ID | Requirement |
|---|---|
| NFR-1.1 | Parsing a 75-card decklist SHALL complete in under 100 ms. |
| NFR-1.2 | A 75-card deck SHALL be fully resolved and rendered within 3 seconds on a cold cache over a typical broadband connection, and within 500 ms on a warm cache. |
| NFR-1.3 | Drag interactions SHALL maintain 60 fps on a mid-range laptop. |
| NFR-1.4 | Plan edits SHALL reflect in the UI within 16 ms (no perceptible lag on stepper clicks). |
| NFR-1.5 | Initial JS bundle SHALL be under 300 KB gzipped; PDF generation code SHALL be lazy-loaded only when export is invoked. |
| NFR-1.6 | The app SHALL remain responsive with 50 matchups defined. |

### NFR-2 — Accessibility

| ID | Requirement |
|---|---|
| NFR-2.1 | The app SHALL target WCAG 2.1 Level AA. |
| NFR-2.2 | All functionality, including sideboard planning, SHALL be achievable without a mouse. List mode (FR-9) is the guaranteed accessible path; drag-and-drop is an enhancement. |
| NFR-2.3 | All card images SHALL have meaningful alt text (card name and quantity). |
| NFR-2.4 | Colour SHALL NOT be the sole carrier of meaning; validation states SHALL also use icon and text. |
| NFR-2.5 | Interactive elements SHALL have a visible focus indicator meeting AA contrast. |
| NFR-2.6 | Drag operations SHALL announce state changes via an ARIA live region. |
| NFR-2.7 | The app SHALL respect `prefers-reduced-motion`. |

### NFR-3 — Responsiveness & Browser Support

| ID | Requirement |
|---|---|
| NFR-3.1 | Supported browsers: current and previous major versions of Chrome, Firefox, Safari and Edge. |
| NFR-3.2 | Layout SHALL be functional from 320 px to 2560 px width. |
| NFR-3.3 | Deck viewing and export reading SHALL be first-class on mobile; plan *authoring* is desktop/tablet-optimised but SHALL remain possible on mobile via list mode. |
| NFR-3.4 | The app SHALL support light and dark themes, following system preference by default. |

### NFR-4 — Reliability & Resilience

| ID | Requirement |
|---|---|
| NFR-4.1 | Loss of network connectivity SHALL NOT break the app; already-resolved cards, all planning, and all export SHALL continue to work. |
| NFR-4.2 | A Scryfall outage SHALL produce a clear, actionable message and a text-only fallback, never a blank screen. |
| NFR-4.3 | An unhandled error in one matchup's plan SHALL NOT corrupt or discard other matchups (error boundaries around plan views). |
| NFR-4.4 | Corrupt or version-mismatched `localStorage` data SHALL be detected and discarded gracefully rather than crashing on load. |

### NFR-5 — Security & Privacy

| ID | Requirement |
|---|---|
| NFR-5.1 | v1 SHALL collect no personal data and require no account. |
| NFR-5.2 | All user content SHALL remain in the browser; the only outbound requests SHALL be to Scryfall for card data and images. |
| NFR-5.3 | All user-supplied text (deck names, matchup names, game plans) SHALL be escaped/sanitised on render and on export to prevent injection, including in generated Markdown and PDF. |
| NFR-5.4 | Uploaded files SHALL be size-capped (≤ 1 MB) and parsed as plain text/XML only, never evaluated. |
| NFR-5.5 | The app SHALL ship a Content Security Policy restricting connections to self and Scryfall origins. |
| NFR-5.6 | Any analytics, if added, SHALL be privacy-preserving and SHALL NOT transmit decklist content. |

### NFR-6 — Maintainability & Quality

| ID | Requirement |
|---|---|
| NFR-6.1 | The codebase SHALL be TypeScript in strict mode. |
| NFR-6.2 | Domain logic (parsing, validation, plan arithmetic, export generation) SHALL be pure, framework-independent modules with no React or DOM dependency. |
| NFR-6.3 | Domain logic SHALL have unit test coverage ≥ 90%; the parser SHALL have a fixture-based test suite covering every accepted variant in FR-1.7 plus known malformed inputs. |
| NFR-6.4 | Scryfall access SHALL sit behind a single client module so it can be swapped for a server-side proxy in v2 without touching feature code. |
| NFR-6.5 | Linting and formatting SHALL be enforced in CI along with type-checking and tests. |
| NFR-6.6 | Runtime validation of external data (Scryfall responses, imported JSON) SHALL use a schema validator (e.g. Zod) rather than type assertions. |

### NFR-7 — Legal & Attribution

| ID | Requirement |
|---|---|
| NFR-7.1 | The app SHALL display Scryfall attribution and SHALL comply with Scryfall's API guidelines on rate limiting, caching, and `User-Agent` identification. |
| NFR-7.2 | The app SHALL carry the Wizards of the Coast Fan Content Policy disclaimer, stating it is unofficial Fan Content and not approved/endorsed by Wizards of the Coast. |
| NFR-7.3 | The app SHALL NOT charge money, gate features behind payment, or run advertising against WotC intellectual property, consistent with the Fan Content Policy. |
| NFR-7.4 | Card images SHALL be served from Scryfall's CDN and SHALL NOT be re-hosted or bulk-redistributed. |
| NFR-7.5 | Exported documents SHALL include the same attribution and disclaimer. |

---

## 9. Domain Model

Conceptual model. Framework-agnostic and stable across v1 (in-memory) and v2 (persisted).

```
Workspace
├── schemaVersion: string
├── deck: Deck
└── matchups: Matchup[]

Deck
├── id, name
├── format: 'standard'|'pioneer'|'modern'|'legacy'|'vintage'|'pauper'|'unknown'
├── maindeck: DeckEntry[]
├── sideboard: DeckEntry[]
└── importedAt, sourceText

DeckEntry
├── cardId: string          // stable Scryfall oracle id
├── quantity: number
└── requestedPrinting?: { set, collectorNumber }

Card                         // cached, resolved from Scryfall
├── oracleId, name, manaCost, manaValue
├── typeLine, oracleText, colors, colorIdentity
├── rarity, set, collectorNumber, layout
├── imageUris, faces[]
└── cachedAt

Matchup
├── id, name, priority?, tags[]
├── opponentDeck?: Deck
├── gamePlan: string        // markdown
├── splitPlayDraw: boolean
└── plans: { unified?: SideboardPlan, onPlay?: SideboardPlan, onDraw?: SideboardPlan }

SideboardPlan
├── out: PlanEntry[]
├── in:  PlanEntry[]
└── (derived) validation: PlanValidation

PlanEntry
├── cardId, quantity
└── note?: string

PlanValidation             // computed, never stored
├── outTotal, inTotal, delta
├── postBoardSize
└── issues: ValidationIssue[]
```

**Key modelling decisions**

1. Plans reference cards by **stable card identity, not array index**, so a deck re-import (FR-6.9) can be reconciled rather than invalidating everything.
2. `PlanValidation` is **derived, never persisted** — a single source of truth prevents a stored plan from ever disagreeing with its own validity.
3. The two planning UIs (FR-8, FR-9) are pure views over `SideboardPlan`; there is exactly one plan state, satisfying FR-9.6 by construction rather than by synchronisation code.
4. `Workspace` is the natural unit of persistence — in v1 it serialises to a JSON file and `localStorage`; in v2 it becomes a database row with an owner. No model change required.

---

## 10. Architecture & Scalability

### 10.1 v1 Architecture

```
┌─────────────────────────────────────────────────┐
│  Next.js App (client-rendered, no backend calls)│
│                                                 │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Import UI │  │ Deck View  │  │ Plan View  │  │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘  │
│        └──────────────┴───────────────┘         │
│                       │                         │
│        ┌──────────────▼──────────────┐          │
│        │  Domain layer (pure TS)     │          │
│        │  parser · validator · plan  │          │
│        │  arithmetic · exporters     │          │
│        └──────────────┬──────────────┘          │
│                       │                         │
│        ┌──────────────▼──────────────┐          │
│        │  Card repository (interface)│          │
│        │  ├ ScryfallClient           │          │
│        │  └ Cache (memory+localStorage)│        │
│        └──────────────┬──────────────┘          │
└───────────────────────┼─────────────────────────┘
                        ▼
                  Scryfall API
```

### 10.2 Layering Rules

| Rule | Why |
|---|---|
| The domain layer imports nothing from React, Next.js, or the DOM. | Makes it trivially testable and reusable by a future server, CLI, or mobile client. |
| All Scryfall access goes through a `CardRepository` interface. | v2 swaps the implementation for a server-side proxy with a shared cache; no feature code changes (NFR-6.4). |
| All state mutation goes through explicit plan actions (add/remove/set quantity). | Gives undo/redo (FR-8.9) and a future server sync a single choke point. |
| Export generators consume the domain model, not React state. | The same generator runs server-side in v2 for emailed/shared PDFs. |

### 10.3 Forward Path to v2+

These are **not** v1 work. They are listed to demonstrate that the v1 design does not have to be undone.

| Capability | What v1 already provides | What v2 adds |
|---|---|---|
| **Accounts & cloud sync** | `Workspace` is a self-contained serialisable aggregate with a schema version. | Auth provider, `workspaces` table keyed by user, sync layer. |
| **Server-side Scryfall proxy** | `CardRepository` interface; all calls behind it. | Route handler + shared server cache; one shared rate-limit budget instead of per-client. |
| **Sharing plans by link** | Export generators are pure functions of the model. | Persist workspace, serve a read-only route. |
| **Deck building / card search** | Card model and repository already in place. | Search UI + Scryfall search endpoints. |
| **Additional formats** | `format` field exists; validation rules are isolated in one module. | Pluggable format rule sets (Commander, Limited). |
| **Metagame-driven matchups** | `Matchup` is decoupled from `Deck`. | Ingest metagame data, suggest matchups. |

---

## 11. Assumptions, Risks & Open Questions

### 11.1 Assumptions

| ID | Assumption |
|---|---|
| A-1 | Users arrive with an existing, tuned decklist. The app does not need to help them build one. |
| A-2 | Scryfall remains publicly available and free for this scale of use. |
| A-3 | Users have network access when importing a deck, but may not have it at the venue when reading the export. |
| A-4 | A sideboard plan is authored on a laptop and consumed on a phone or on paper. |

### 11.2 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-1 | **Work loss on refresh.** With no persistence, a tab close destroys an hour of planning. | High — likely cause of abandonment. | FR-11.4 local autosave + FR-11.1 workspace file export. Deliberate, browser-only, no backend. |
| R-2 | **Scryfall rate limiting or outage.** | Medium | Aggressive caching (FR-2.5), batching (FR-2.2), backoff (FR-2.11), text fallback. |
| R-3 | **Decklist parsing edge cases** — split cards, DFCs, accented names, unusual exports. | Medium — a failed import is a total blocker for that user. | Broad accepted grammar (FR-1.7), inline correction UI (FR-2.10), fixture test suite (NFR-6.3). |
| R-4 | **Accessible drag-and-drop is genuinely hard.** | Medium | List mode (FR-9) is the guaranteed-accessible path; DnD is an enhancement, built on dnd-kit (FR-8.8). |
| R-5 | **Client-side PDF quality** — page breaks, fonts, print fidelity. | Medium | Prototype the PDF path early; validate against a real printed page and a real phone screen before committing to the library. |
| R-6 | **Fan Content Policy compliance** if the project is ever monetised. | Low now, high if it changes | NFR-7; revisit before any commercial move. |

### 11.3 Open Questions

| ID | Question | Blocking? |
|---|---|---|
| Q-1 | Should the deck view offer a "companion/commander"-style featured card slot for decks that play a Companion? | No — deferrable to v1.1. |
| Q-2 | Should the export include the opponent's decklist when present, or only the plan? Including it makes the binder long; excluding it loses context. | No — defaulting to plan-only with an include toggle. |
| Q-3 | Is a printed-sheet-per-matchup layout (one matchup per physical page, regardless of length) preferable to compact continuous flow? | No — defaulting to compact flow with no mid-matchup page break; revisit after the first real print test. |
| Q-4 | Should matchup plans be orderable by expected metagame share to put the most likely opponents first in the export? | No — FR-5.5 manual reorder covers v1. |

---

## 12. Deferred Features (Post-v1)

| Feature | Notes |
|---|---|
| Commander/EDH support | 100-card singleton, command zone, no traditional sideboard — needs a distinct display and no plan mode. |
| Limited (40-card) support | Smaller deck minimum, unbounded sideboard from the pool. |
| Accounts, cloud sync, shareable links | See §10.3. |
| Import from Moxfield/Archidekt/MTGGoldfish URLs | Requires either their APIs or a server-side fetch (CORS). |
| Deck building: search, add/remove, price data | |
| Banned/restricted list validation | |
| Metagame integration and suggested matchups | |
| Collaborative/team plan sharing | |
| Playtesting or goldfishing | |

---

## 13. Acceptance Criteria (v1 Definition of Done)

v1 is complete when a user can, in a single uninterrupted session with no account and no setup:

1. Paste an MTGO decklist and see the full 75 rendered as card images with correct quantities, maindeck and sideboard separated, within 3 seconds.
2. Be told clearly and specifically about any line that failed to parse or resolve, and fix it in place.
3. Create at least five named matchups.
4. Build a sideboard plan for each using drag-and-drop, and edit the same plans in list mode with no loss or divergence.
5. Be prevented from boarding in more copies than exist in the sideboard, and be warned the moment a plan goes unbalanced.
6. Write a game plan per matchup.
7. Export a single Markdown file and a single PDF containing the deck and all five matchup plans, correctly formatted, with attribution.
8. Print the PDF in black and white and read every plan; open the same PDF on a phone and read it without horizontal scrolling.
9. Refresh the browser and be offered their work back.
10. Complete steps 3–8 with the network disconnected after the initial deck import.

---

## 14. Traceability

| User story | Requirements |
|---|---|
| A1, A2 | FR-1.1, FR-1.2, FR-1.3 |
| A3 | FR-1.5, FR-2.10 |
| A4 | FR-1.6, FR-6.9 |
| B1 | FR-3.1, FR-3.2, FR-2.7 |
| B2 | FR-3.4, FR-3.5, FR-3.6 |
| B3 | FR-3.8 |
| B4 | FR-3.7, FR-2.9 |
| C1–C4 | FR-5.1 – FR-5.8 |
| D1 | FR-8.1 – FR-8.5 |
| D2 | FR-9.1 – FR-9.5 |
| D3 | FR-9.6, FR-9.7 |
| D4 | FR-7.1 – FR-7.5 |
| D5 | FR-6.6 |
| D6 | FR-6.8, FR-7.7 |
| D7 | FR-6.10 |
| E1 | FR-10.5 – FR-10.8 |
| E2 | FR-10.4 |
| E3 | FR-10.8, NFR-3.3 |
| E4 | FR-11.1 – FR-11.4 |

---

*Magic: The Gathering is a trademark of Wizards of the Coast LLC. This project is unofficial Fan Content permitted under the Fan Content Policy, not approved or endorsed by Wizards of the Coast. Card data and imagery provided by Scryfall.*
