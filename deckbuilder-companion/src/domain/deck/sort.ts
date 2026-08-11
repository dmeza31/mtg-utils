/**
 * SPEC-B Task B-2 — sorting within a group (FR-3.5). Pure: never mutates
 * its input, and every ordering is a total order (a tiebreak on every path)
 * so the result never depends on the input's original order.
 */
import type { ResolvedEntry } from "./queries";

export type SortBy = "manaValue" | "name" | "quantity";

const COLLATOR = new Intl.Collator("en", { sensitivity: "base" });

function byName(a: ResolvedEntry, b: ResolvedEntry): number {
  return COLLATOR.compare(a.card.name, b.card.name);
}

export function sortEntries(
  entries: readonly ResolvedEntry[],
  by: SortBy,
): readonly ResolvedEntry[] {
  const copy = [...entries];
  switch (by) {
    case "manaValue":
      return copy.sort((a, b) => a.card.manaValue - b.card.manaValue || byName(a, b));
    case "name":
      return copy.sort(byName);
    case "quantity":
      return copy.sort((a, b) => b.quantity - a.quantity || byName(a, b));
  }
}
