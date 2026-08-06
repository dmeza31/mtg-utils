/**
 * SPEC-002 Task 7 (FR-4.1–4.3). Validation is advisory in v1 — it warns, it
 * never blocks (FR-4.4). Banned/restricted lists are explicitly out of scope
 * (FR-4.5).
 */
import type { CardRepository } from "../ports/CardRepository";
import type { Card, CardId, Deck } from "../model/types";
import { countCards, distinctCardIds, totalCopiesIn75 } from "./queries";

export type DeckIssueCode =
  "maindeck-below-minimum" | "sideboard-over-maximum" | "exceeds-card-limit";

export interface DeckIssue {
  readonly code: DeckIssueCode;
  readonly message: string;
  readonly cardId?: CardId;
}

const MINIMUM_MAINDECK_SIZE = 60;
const MAXIMUM_SIDEBOARD_SIZE = 15;
const DEFAULT_CARD_LIMIT = 4;

/** Number words as they actually appear in Oracle text ("up to seven cards named"). */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/**
 * The deck-construction copy limit for a card (FR-4.3). Isolated from
 * `validateDeck` so new exemptions (a future Seven Dwarves-alike) are one
 * table row here, not a change to any caller.
 */
export function deckLimitFor(card: Card): number {
  if (card.typeLine.includes("Basic Land")) {
    return Infinity;
  }

  const oracleText = card.oracleText ?? "";

  if (oracleText.includes("any number of cards named")) {
    return Infinity;
  }

  const match = /up to (\w+) cards named/i.exec(oracleText);
  const word = match?.[1]?.toLowerCase();
  if (word !== undefined && word in NUMBER_WORDS) {
    return NUMBER_WORDS[word] as number;
  }

  return DEFAULT_CARD_LIMIT;
}

export function validateDeck(deck: Deck, repo: CardRepository): readonly DeckIssue[] {
  const issues: DeckIssue[] = [];

  const maindeckSize = countCards(deck.maindeck);
  if (maindeckSize < MINIMUM_MAINDECK_SIZE) {
    issues.push({
      code: "maindeck-below-minimum",
      message: `Maindeck has ${maindeckSize} cards — below the ${MINIMUM_MAINDECK_SIZE}-card minimum (FR-4.1).`,
    });
  }

  const sideboardSize = countCards(deck.sideboard);
  if (sideboardSize > MAXIMUM_SIDEBOARD_SIZE) {
    issues.push({
      code: "sideboard-over-maximum",
      message: `Sideboard has ${sideboardSize} cards — exceeds the ${MAXIMUM_SIDEBOARD_SIZE}-card maximum (FR-4.2).`,
    });
  }

  for (const cardId of distinctCardIds(deck)) {
    const card = repo.peek(cardId);
    // Unresolvable: skip rather than warn. A false warning on a card we
    // simply failed to look up is worse than a missed warning.
    if (card === undefined) {
      continue;
    }

    const limit = deckLimitFor(card);
    const total = totalCopiesIn75(deck, cardId);
    if (total > limit) {
      issues.push({
        code: "exceeds-card-limit",
        message: `${card.name} appears ${total} times — exceeds the ${limit}-copy limit (FR-4.3).`,
        cardId,
      });
    }
  }

  return issues;
}
