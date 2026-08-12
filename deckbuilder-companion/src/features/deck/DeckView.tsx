"use client";

/**
 * SPEC-B Task B-5 — the deck view: totals (FR-3.3), the maindeck grid, and
 * a visually distinct sideboard section (FR-3.2). Grouping/sorting (task
 * B-6) and the stacked-column layout toggle (task B-7) live here as the
 * controls that feed `DeckGrid`.
 */
import { useEffect, useState } from "react";
import { countCards, resolveEntries } from "@/domain/deck/queries";
import { groupEntries, type GroupBy } from "@/domain/deck/group";
import type { Deck } from "@/domain/model/types";
import { sortEntries, type SortBy } from "@/domain/deck/sort";
import { useCardRepository, useWorkspaceState } from "@/state/WorkspaceProvider";
import { useDeckViewPreferences } from "./DeckViewPreferences";
import { DeckGrid, type DeckLayout } from "./DeckGrid";
import { StatisticsPanel } from "./StatisticsPanel";

const GROUP_OPTIONS: ReadonlyArray<{ value: GroupBy; label: string }> = [
  { value: "type", label: "Type" },
  { value: "manaValue", label: "Mana value" },
  { value: "color", label: "Colour" },
  { value: "none", label: "None" },
];

const SORT_OPTIONS: ReadonlyArray<{ value: SortBy; label: string }> = [
  { value: "manaValue", label: "Mana value" },
  { value: "name", label: "Name" },
  { value: "quantity", label: "Quantity" },
];

const TABLET_QUERY = "(min-width: 768px)";

// B-7 — the stacked layout falls back to grid below the tablet breakpoint.
function useIsTabletOrWider(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(TABLET_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(TABLET_QUERY);
    const listener = () => setMatches(mql.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  return matches;
}

export interface DeckViewProps {
  /** SPEC-C task C-7 — an opponent's deck, rendered instead of `workspace.deck`. */
  readonly deck?: Deck;
  /** SPEC-C task C-7 — hides grouping/sort/layout controls and the statistics panel for the matchup's opponent-deck panel. */
  readonly compact?: boolean;
}

export function DeckView({ deck: deckProp, compact = false }: DeckViewProps) {
  const workspaceDeck = useWorkspaceState((s) => s.workspace.deck);
  const deck = deckProp ?? workspaceDeck;
  const repo = useCardRepository();
  const { groupBy, setGroupBy, sortBy, setSortBy, layout, setLayout } = useDeckViewPreferences();
  const isTabletOrWider = useIsTabletOrWider();

  if (deck === undefined) return null;

  const effectiveLayout: DeckLayout =
    !compact && layout === "stacked" && isTabletOrWider ? "stacked" : "grid";

  const maindeckEntries = sortEntries(resolveEntries(deck, "maindeck", repo), sortBy);
  const sideboardEntries = sortEntries(resolveEntries(deck, "sideboard", repo), sortBy);
  const maindeckGroups = groupEntries(maindeckEntries, groupBy);
  const sideboardGroups = groupEntries(sideboardEntries, groupBy);

  return (
    <div className="space-y-8" data-testid="deck-view">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-foreground text-sm font-medium" data-testid="deck-totals">
          Maindeck {countCards(deck.maindeck)} · Sideboard {countCards(deck.sideboard)}
        </p>

        {!compact ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Group by</span>
              <select
                data-testid="deck-group-by"
                className="border-border bg-background rounded-md border px-2 py-1"
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value as GroupBy)}
              >
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Sort by</span>
              <select
                data-testid="deck-sort-by"
                className="border-border bg-background rounded-md border px-2 py-1"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="hidden items-center gap-2 md:flex">
              <span className="text-muted-foreground">Layout</span>
              <select
                data-testid="deck-layout"
                className="border-border bg-background rounded-md border px-2 py-1"
                value={layout}
                onChange={(event) => setLayout(event.target.value as DeckLayout)}
              >
                <option value="grid">Grid</option>
                <option value="stacked">Stacked</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {!compact ? <StatisticsPanel deck={deck} repo={repo} /> : null}

      <section aria-labelledby="maindeck-heading">
        <h2 id="maindeck-heading" className="text-foreground mb-3 text-lg font-semibold">
          Maindeck
        </h2>
        <DeckGrid groups={maindeckGroups} layout={effectiveLayout} deck={deck} />
      </section>

      <section
        aria-labelledby="sideboard-heading"
        data-testid="sideboard-section"
        className="border-border bg-muted/40 rounded-lg border-t-2 p-4"
      >
        <h2 id="sideboard-heading" className="text-foreground mb-3 text-lg font-semibold">
          Sideboard
        </h2>
        <DeckGrid groups={sideboardGroups} layout={effectiveLayout} deck={deck} />
      </section>
    </div>
  );
}
