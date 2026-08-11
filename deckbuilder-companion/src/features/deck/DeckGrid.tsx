"use client";

/**
 * SPEC-B Task B-5 (grid) / B-7 (stacked columns). Renders one zone's
 * grouped, sorted card groups as either a flat responsive grid or a
 * Moxfield-style overlapping column layout. Group headings are real
 * `<h3>`s (FR-3.4's group label plus a per-group count) so screen-reader
 * users can navigate the deck by heading.
 */
import type { CardGroup } from "@/domain/deck/group";
import type { Deck } from "@/domain/model/types";
import { CardDetail } from "./CardDetail";

export type DeckLayout = "grid" | "stacked";

export interface DeckGridProps {
  readonly groups: readonly CardGroup[];
  readonly layout: DeckLayout;
  readonly deck: Deck;
  readonly headingLevel?: "h2" | "h3";
}

// FR-3.9 / NFR-3.2 — 2 columns at 320px up to 8 at 2560px.
const GRID_COLUMNS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 min-[2200px]:grid-cols-8";

export function DeckGrid({ groups, layout, deck, headingLevel = "h3" }: DeckGridProps) {
  const Heading = headingLevel;

  if (groups.length === 0) {
    return <p className="text-muted-foreground text-sm">No cards.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key} data-testid="card-group">
          <Heading className="text-foreground mb-2 text-sm font-semibold tracking-wide uppercase">
            {group.label}{" "}
            <span className="text-muted-foreground font-normal">({group.entries.length})</span>
          </Heading>
          {layout === "grid" ? (
            <div className={GRID_COLUMNS}>
              {group.entries.map((entry) => (
                <CardDetail
                  key={entry.cardId}
                  cardId={entry.cardId}
                  card={entry.card}
                  quantity={entry.quantity}
                  deck={deck}
                />
              ))}
            </div>
          ) : (
            <StackedColumn group={group} deck={deck} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * B-7 — cards overlap vertically via negative margins (not absolute
 * positioning, which breaks keyboard focus scrolling). Each tile keeps an
 * always-visible title strip so the name is readable at the overlap
 * offset without needing hover; hover/focus cancels the overlap for that
 * tile and raises it above its neighbours. `focus-within` (not the wrapper's
 * own `tabIndex`) drives the focus state, since `CardDetail`'s trigger is
 * the actual focusable element.
 */
function StackedColumn({ group, deck }: { group: CardGroup; deck: Deck }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3 md:grid-cols-4">
      {group.entries.map((entry) => {
        const displayName = entry.card.faces?.[0]?.name ?? entry.card.name;
        return (
          <div
            key={entry.cardId}
            data-testid="stacked-card"
            className="relative -mb-24 w-full rounded-lg transition-[margin] duration-150 last:mb-0 focus-within:z-10 focus-within:mb-0 hover:z-10 hover:mb-0"
          >
            <div className="border-border bg-background/95 absolute top-0 right-0 left-0 z-[1] truncate rounded-t-lg border-x border-t px-2 py-1 text-xs font-medium">
              {entry.quantity}× {displayName}
            </div>
            <CardDetail
              cardId={entry.cardId}
              card={entry.card}
              quantity={entry.quantity}
              deck={deck}
            />
          </div>
        );
      })}
    </div>
  );
}
