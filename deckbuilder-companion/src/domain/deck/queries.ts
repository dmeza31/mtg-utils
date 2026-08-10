/**
 * SPEC-002 Task 3 — small, total functions with no I/O over the deck model.
 */
import type { CardId, Deck, DeckEntry, Zone } from "../model/types";

export function countCards(entries: readonly DeckEntry[]): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

function zoneEntries(deck: Deck, zone: Zone): readonly DeckEntry[] {
  return zone === "maindeck" ? deck.maindeck : deck.sideboard;
}

/** A card's copies in one zone only — the two zones never combine (FR-6.5). */
export function copiesOf(deck: Deck, cardId: CardId, zone: Zone): number {
  return zoneEntries(deck, zone)
    .filter((entry) => entry.cardId === cardId)
    .reduce((total, entry) => total + entry.quantity, 0);
}

export function totalCopiesIn75(deck: Deck, cardId: CardId): number {
  return copiesOf(deck, cardId, "maindeck") + copiesOf(deck, cardId, "sideboard");
}

export function distinctCardIds(deck: Deck): readonly CardId[] {
  const seen = new Set<CardId>();
  for (const entry of [...deck.maindeck, ...deck.sideboard]) {
    seen.add(entry.cardId);
  }
  return [...seen];
}
