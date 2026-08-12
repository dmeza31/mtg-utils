/**
 * SPEC-D Task D-1 (FR-7.4) — "what can the user do right now" as one tested
 * projection, so both the drag and list UIs read the same numbers instead
 * of each re-deriving them from `SideboardPlan` + `Deck`.
 */
import { copiesOf } from "../deck/queries";
import type { CardId, Deck, PlanEntry, SideboardPlan, Zone } from "../model/types";

export interface CardAvailability {
  readonly cardId: CardId;
  readonly inDeck: number;
  readonly planned: number;
  readonly remaining: number;
  readonly canAdd: boolean;
  readonly canRemove: boolean;
}

function plannedQuantities(entries: readonly PlanEntry[]): ReadonlyMap<CardId, number> {
  const planned = new Map<CardId, number>();
  for (const entry of entries) {
    planned.set(entry.cardId, (planned.get(entry.cardId) ?? 0) + entry.quantity);
  }
  return planned;
}

function projectAvailability(
  deck: Deck,
  zone: Zone,
  entries: readonly PlanEntry[],
): readonly CardAvailability[] {
  const planned = plannedQuantities(entries);
  const cardIds = new Set<CardId>([...deck[zone].map((entry) => entry.cardId), ...planned.keys()]);

  return [...cardIds].map((cardId) => {
    const inDeck = copiesOf(deck, cardId, zone);
    const plannedQuantity = planned.get(cardId) ?? 0;
    const remaining = Math.max(0, inDeck - plannedQuantity);
    return {
      cardId,
      inDeck,
      planned: plannedQuantity,
      remaining,
      canAdd: remaining > 0,
      canRemove: plannedQuantity > 0,
    };
  });
}

export function maindeckAvailability(deck: Deck, plan: SideboardPlan): readonly CardAvailability[] {
  return projectAvailability(deck, "maindeck", plan.out);
}

export function sideboardAvailability(
  deck: Deck,
  plan: SideboardPlan,
): readonly CardAvailability[] {
  return projectAvailability(deck, "sideboard", plan.in);
}
