# SPEC-E — Epic E: Export and Carry

| | |
|---|---|
| **Depends on** | SPEC-D |
| **Blocks** | — (ships v1) |
| **Stories** | E1, E2, E3, E4 |
| **Requirements** | FR-10.x, FR-11.x, NFR-1.5, NFR-4.1, NFR-4.4, NFR-5.3, NFR-7.5 |
| **Estimated size** | One and a half to two sessions |

---

## 1. Goal

Turn the workspace into the artifact the whole product exists for (principle P2): a binder — deck summary plus one section per matchup — as Markdown and as a PDF that is genuinely usable in round 3 with four minutes on the clock. Plus save/restore so the work survives.

---

## 2. Domain tasks

### Task E-1 — Binder view model ⭐

`src/domain/export/binder.ts` — the piece that makes both exporters trivial and makes both testable without a renderer.

```ts
export interface BinderDocument {
  readonly title: string
  readonly generatedAt: string
  readonly deck: BinderDeckSummary
  readonly matchups: readonly BinderMatchup[]
  readonly attribution: string          // FR-10.13, NFR-7.5
}
export interface BinderMatchup {
  readonly name: string
  readonly priority?: Priority
  readonly gamePlan: string
  readonly variants: readonly BinderPlanVariant[]  // 1 when unified, 2 when split
  readonly isIncomplete: boolean        // FR-7.6
}
export interface BinderPlanVariant {
  readonly label: 'Sideboard plan' | 'On the play' | 'On the draw'
  readonly out: readonly BinderPlanLine[]
  readonly in: readonly BinderPlanLine[]
  readonly outTotal: number
  readonly inTotal: number
  readonly balanceNote?: string         // e.g. "Unbalanced: 2 out, 3 in"
}
export interface BinderPlanLine {
  readonly quantity: number
  readonly name: string
  readonly note?: string                // FR-6.7
}

export function buildBinder(ws: Workspace, repo: CardRepository, opts: BinderOptions): BinderDocument
```

`buildBinder` uses `repo.peek()` only — never network I/O. That is what makes FR-10.12 (export works offline) a property of the design rather than something to test for and hope.

**Tests first:**
- Every FR-10.2 element is present in the output.
- A split matchup produces two labelled variants (FR-10.3).
- An unbalanced plan sets `balanceNote` and `isIncomplete` (FR-7.6) — it exports, it doesn't get dropped.
- Per-card notes flow through (FR-6.7).
- `opts.matchupIds` filters the selection (FR-10.10).
- Matchups appear in the user's sidebar order by default.
- Attribution is always present and cannot be turned off (NFR-7.5).
- An unresolvable card falls back to its raw imported name rather than a blank line — an export missing a line is worse than one with an imperfect name.
- Plan lines sort by quantity descending, then by name, so two exports of the same plan are identical.

### Task E-2 — Markdown generator (E2)

`src/domain/export/markdown.ts`

```ts
export function renderMarkdown(doc: BinderDocument): string
```

Target shape:

```markdown
# Izzet Murktide — Sideboard Binder
*Generated 2026-08-04*

## Deck
**Maindeck (60)**
4 Lightning Bolt
...
**Sideboard (15)**
...

---

## vs. Amulet Titan  ·  High priority

**Game plan**
Be the aggressor. Their combo is faster than your clock...

**On the play** — 3 out / 3 in
| | Out | | In |
|---|---|---|---|
| 2 | Consider | 3 | Force of Negation |
...
```

**Tests first:** snapshot the full document for a fixture workspace; assert escaping of `|`, `*`, `_`, `#` and backticks in user-supplied names and game plans (**NFR-5.3** — a matchup named `Deck | Foo` must not break the table, and an injected link must not become live markup); assert the output is deterministic across two calls; assert a matchup with no plan still renders a section rather than vanishing.

Markdown escaping is easy to skip and produces subtly corrupted documents that the user only discovers at the tournament. Write the escaping test before the generator.

---

## 3. PDF tasks

### Task E-3 — PDF document (E1)

`src/features/export/pdf/BinderPdf.tsx` using `@react-pdf/renderer`.

- **Lazy-loaded** — `next/dynamic` with `ssr: false` (NFR-1.5). The PDF renderer is large; users who never export must not pay for it.
- Single-column layout throughout (FR-10.8)
- Body text ≥ 10 pt (FR-10.8)
- `<View wrap={false}>` around each matchup section → FR-10.6 falls out directly. Sections longer than a page still wrap; the requirement is only that they don't split *unnecessarily*.
- **Black-and-white legible** (FR-10.7): OUT and IN distinguished by heading text and a `−`/`+` glyph, not by red/green fill. Test this by rendering with a grayscale assertion, not by eye.
- Repeating footer with page number and the attribution (FR-10.13)
- Embedded font subset so the PDF renders identically everywhere — no system-font dependency

Layout per matchup:

```
─────────────────────────────────────
vs. AMULET TITAN                 High
─────────────────────────────────────
GAME PLAN
Be the aggressor...

ON THE PLAY                 3 out/3 in
  OUT                  IN
  − 2 Consider         + 3 Force of Negation
  − 1 Spell Pierce
─────────────────────────────────────
```

### Task E-4 — Export dialog (E1, E2)

`src/features/export/ExportDialog.tsx`

- Format: Markdown / PDF
- Matchup selection with select-all (FR-10.10)
- Options: include per-card notes, include card thumbnails (**default off** — FR-10.11)
- In-app preview before download (FR-10.9)
- Download via `Blob` + object URL, revoked after use
- Filename: `<deck-name>-sideboard-binder.<ext>`, slugified
- Progress indicator — PDF generation on a 20-matchup workspace is not instant

### Task E-5 — Thumbnails (FR-10.11, priority C)

Off by default. When on, embed `small` images as base64 from cache. Cap the resulting file size and warn past a threshold — a 40 MB PDF that won't open on a phone defeats the purpose. Skip this entirely if time is short.

---

## 4. Portability tasks

### Task E-6 — Workspace serialisation (E4, FR-11.1–11.3)

`src/domain/export/workspace.ts`

```ts
export function serializeWorkspace(ws: Workspace): string     // versioned JSON
export function deserializeWorkspace(json: string): Result<Workspace, WorkspaceError>
export const workspaceSchema: z.ZodType<Workspace>            // NFR-6.6
```

- `schemaVersion` on every export (FR-11.3)
- Zod validation on import; a `Result`, never a throw
- Migration hook `migrate(raw, fromVersion)` — for v1 it's an identity function, but the seam exists so v2 doesn't have to invent one
- **Card data is not serialised** — only card IDs. The workspace file stays small and cannot go stale; cards re-resolve from cache or Scryfall on load.

**Tests first:** round-trip a full workspace to JSON and back to a deep-equal object; a corrupt file returns an error, doesn't throw (NFR-4.4); an unknown future `schemaVersion` returns a clear "made by a newer version" message rather than a validation dump; a v1 file with extra unknown fields loads (forward tolerance).

### Task E-7 — Autosave and restore (FR-11.4)

`src/adapters/storage/autosave.ts`

- Debounced write of the serialised workspace to `localStorage` (~1 s)
- On load, if a saved workspace exists, offer to restore it — **offer**, don't silently apply. Silently restoring stale work when the user came to start fresh is its own kind of data loss.
- Corrupt saved state is discarded with a message (NFR-4.4)
- `QuotaExceededError` degrades to a warning; the app keeps working
- "Clear all local data" in settings (FR-11.5), with confirmation
- Namespaced, versioned key: `dbc:workspace:v1`

This is R-1 from the requirements — the mitigation for the highest-likelihood abandonment cause. Treat it as `M`, not as polish.

---

## 5. E2E specs

### `E1-export-pdf.spec.ts` — `@cross-browser`
1. Build a workspace with a deck and three matchups → export PDF → download event fires with the expected filename.
2. Parse the downloaded PDF (`pdf-parse`) and assert: deck name present, all three matchup names present, OUT and IN card names present, attribution present (FR-10.13).
3. A split play/draw matchup renders both labelled variants (FR-10.3).
4. An unbalanced plan exports with its incomplete marker (FR-7.6).
5. Matchup selection limits the output to the chosen matchups (FR-10.10).
6. `scryfall.offline()` → export still succeeds (FR-10.12, NFR-4.1). Run this test with the network mock aborting everything; if it passes, offline export is real.
7. Thumbnails off by default → file size stays small (FR-10.11).

### `E2-export-markdown.spec.ts`
1. Export Markdown → download fires → content matches the expected structure.
2. A matchup named `Combo | Titan` doesn't corrupt the table (NFR-5.3).
3. Game plan Markdown is preserved.
4. Per-card notes appear when enabled.
5. Preview matches the downloaded file byte-for-byte.

### `E3-mobile-readable-export.spec.ts` — `@mobile`
1. Open the export preview on the mobile project → single column, no horizontal scroll (FR-10.8, E3).
2. Body text computed size ≥ the 10 pt equivalent.
3. Every matchup section is reachable by scrolling; nothing is clipped.
4. `expectNoA11yViolations` on the preview.

### `E4-workspace-save-restore.spec.ts`
1. Build a workspace → export JSON → download fires.
2. Reload with cleared local state → import the JSON → deck, matchups, plans and notes all restored.
3. Build a workspace → **reload the page** → offered a restore → accept → everything intact (FR-11.4). This is the R-1 regression test; it is the most valuable test in this spec.
4. Decline the restore → a clean empty state, and the saved data is gone.
5. Import `corrupt.json` → clear error, app still usable (NFR-4.4).
6. Import `future-version.json` → a "newer version" message, not a crash (FR-11.3).
7. "Clear all local data" empties storage after confirmation (FR-11.5).

---

## 6. The manual check that no test replaces

Before calling v1 done, do this once, for real:

1. Export a binder with five realistic matchups.
2. **Print it in black and white on A4/Letter.** Read it at arm's length. Can you find the "vs. Amulet Titan" section in under three seconds while shuffling?
3. **AirDrop the PDF to a phone.** Open it in the default viewer. Read a matchup without pinch-zooming.

Requirements Q-3 and R-5 are both open on exactly this, and neither is decidable from a screenshot. If the printed page fails, the fix is in E-3's layout, and it's much cheaper to find now than after the first tournament.

---

## 7. Definition of Done

- [ ] `buildBinder` uses `peek()` only and never performs I/O.
- [ ] Markdown escaping is tested against `|`, `*`, `_`, `#`, backticks and HTML.
- [ ] PDF text content is asserted by parsing the actual file, not by screenshot.
- [ ] Export succeeds with the network fully offline.
- [ ] PDF is legible in grayscale; no colour-only encoding.
- [ ] Page reload offers restore and restores completely.
- [ ] Corrupt and future-version workspace files degrade gracefully.
- [ ] PDF renderer is not in the initial bundle (verify with a bundle report).
- [ ] All four E-story E2E specs pass.
- [ ] The manual print and phone check in §6 has been done, and Q-3 answered in the requirements doc.
