/**
 * SPEC-002 Task 6 (FR-6.10). Previews the 75 after a sideboard swap: an OUT
 * entry moves copies maindeck → sideboard, an IN entry moves copies
 * sideboard → maindeck. A card in both zones nets out correctly because
 * both moves are applied as independent per-zone deltas.
 */
import type { CardId, Deck, DeckEntry, SideboardPlan } from "../model/types";

function applyDeltas(
  entries: readonly DeckEntry[],
  deltas: ReadonlyMap<CardId, number>,
): readonly DeckEntry[] {
  const result: DeckEntry[] = [];
  const seen = new Set<CardId>();

  for (const entry of entries) {
    seen.add(entry.cardId);
    const quantity = entry.quantity + (deltas.get(entry.cardId) ?? 0);
    if (quantity > 0) {
      result.push({ ...entry, quantity });
    }
  }

  for (const [cardId, delta] of deltas) {
    if (!seen.has(cardId) && delta > 0) {
      result.push({ cardId, quantity: delta });
    }
  }

  return result;
}

function addDelta(deltas: Map<CardId, number>, cardId: CardId, amount: number): void {
  deltas.set(cardId, (deltas.get(cardId) ?? 0) + amount);
}

export function postBoardDeck(deck: Deck, plan: SideboardPlan): Deck {
  const maindeckDeltas = new Map<CardId, number>();
  const sideboardDeltas = new Map<CardId, number>();

  for (const entry of plan.out) {
    addDelta(maindeckDeltas, entry.cardId, -entry.quantity);
    addDelta(sideboardDeltas, entry.cardId, entry.quantity);
  }

  for (const entry of plan.in) {
    addDelta(maindeckDeltas, entry.cardId, entry.quantity);
    addDelta(sideboardDeltas, entry.cardId, -entry.quantity);
  }

  return {
    ...deck,
    maindeck: applyDeltas(deck.maindeck, maindeckDeltas),
    sideboard: applyDeltas(deck.sideboard, sideboardDeltas),
  };
}
