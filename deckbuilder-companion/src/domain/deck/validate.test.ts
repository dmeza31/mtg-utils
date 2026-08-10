/**
 * SPEC-002 Task 7 (FR-4.1–4.3). Validation is advisory: it warns, it never
 * blocks (FR-4.4). `deckLimitFor` is table-tested in isolation per the task
 * instructions, since it is the piece most likely to need new rows later.
 */
import { describe, expect, it } from "vitest";
import { aCard, aDeck } from "../../../tests/support/builders";
import { FakeCardRepository } from "../../../tests/support/FakeCardRepository";
import { toCardId } from "../model/types";
import type { Card } from "../model/types";
import { deckLimitFor, validateDeck } from "./validate";

const bolt = toCardId("card-lightning-bolt");

async function repoWith(cards: readonly Card[]): Promise<FakeCardRepository> {
  const repo = new FakeCardRepository(cards);
  await repo.resolve(cards.map((card) => ({ name: card.name })));
  return repo;
}

describe("deckLimitFor (FR-4.3)", () => {
  const plains = aCard({
    oracleId: toCardId("card-plains"),
    name: "Plains",
    typeLine: "Basic Land — Plains",
  });
  const relentlessRats = aCard({
    oracleId: toCardId("card-relentless-rats"),
    name: "Relentless Rats",
    typeLine: "Creature — Rat",
    oracleText: "A deck can have any number of cards named Relentless Rats.",
  });
  const sevenDwarves = aCard({
    oracleId: toCardId("card-seven-dwarves"),
    name: "Seven Dwarves",
    typeLine: "Creature — Dwarf",
    oracleText: "A deck can have up to seven cards named Seven Dwarves in it instead of four.",
  });
  const nazgul = aCard({
    oracleId: toCardId("card-nazgul"),
    name: "Nazgûl",
    typeLine: "Creature — Nazgûl Wraith",
    oracleText: "A deck can have up to nine cards named Nazgûl in it instead of four.",
  });
  const ordinary = aCard();
  const unrecognizedNumberWord = aCard({
    oracleId: toCardId("card-unrecognized-number-word"),
    name: "Hypothetical Card",
    oracleText:
      "A deck can have up to eleventy cards named Hypothetical Card in it instead of four.",
  });
  const noOracleTextCard: Card = {
    oracleId: toCardId("card-no-oracle-text"),
    name: "Wastes",
    manaValue: 0,
    typeLine: "Land",
    colors: [],
    colorIdentity: [],
    rarity: "common",
    set: "bfz",
    collectorNumber: "1",
    layout: "normal",
    cachedAt: "2026-01-01T00:00:00.000Z",
  };

  it.each([
    ["a basic land", plains, Infinity],
    ["a card permitting any number of copies", relentlessRats, Infinity],
    ["a card with an explicit 'up to seven' limit", sevenDwarves, 7],
    ["a card with an explicit 'up to nine' limit", nazgul, 9],
    ["an ordinary nonbasic card", ordinary, 4],
    ["a number word outside the known table falls back to the default", unrecognizedNumberWord, 4],
    ["a card with no oracle text at all", noOracleTextCard, 4],
  ])("%s → limit %i", (_label, card, expected) => {
    expect(deckLimitFor(card)).toBe(expected);
  });
});

describe("validateDeck (FR-4.1, FR-4.2)", () => {
  it("warns when the maindeck has fewer than 60 cards (FR-4.1)", async () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 40 }], sideboard: [] });
    const repo = await repoWith([]);

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).toContain("maindeck-below-minimum");
  });

  it("does not warn when the maindeck has at least 60 cards", async () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 60 }], sideboard: [] });
    const repo = await repoWith([]);

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).not.toContain("maindeck-below-minimum");
  });

  it("warns when the sideboard exceeds 15 cards (FR-4.2)", async () => {
    const deck = aDeck({ maindeck: [], sideboard: [{ cardId: bolt, quantity: 16 }] });
    const repo = await repoWith([]);

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).toContain("sideboard-over-maximum");
  });

  it("does not warn when the sideboard has 15 or fewer cards", async () => {
    const deck = aDeck({ maindeck: [], sideboard: [{ cardId: bolt, quantity: 15 }] });
    const repo = await repoWith([]);

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).not.toContain("sideboard-over-maximum");
  });

  it("warns when a nonbasic card appears more than 4 times across the 75 (FR-4.3)", async () => {
    const card = aCard();
    const deck = aDeck({
      maindeck: [{ cardId: card.oracleId, quantity: 4 }],
      sideboard: [{ cardId: card.oracleId, quantity: 1 }],
    });
    const repo = await repoWith([card]);

    const issues = validateDeck(deck, repo);

    const limitIssue = issues.find((i) => i.code === "exceeds-card-limit");
    expect(limitIssue?.cardId).toBe(card.oracleId);
  });

  it("does not warn at exactly 4 copies", async () => {
    const card = aCard();
    const deck = aDeck({
      maindeck: [{ cardId: card.oracleId, quantity: 4 }],
      sideboard: [],
    });
    const repo = await repoWith([card]);

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).not.toContain("exceeds-card-limit");
  });

  it("does not warn on a card with an explicit higher limit within that limit", async () => {
    const sevenDwarves = aCard({
      oracleId: toCardId("card-seven-dwarves"),
      name: "Seven Dwarves",
      oracleText: "A deck can have up to seven cards named Seven Dwarves in it instead of four.",
    });
    const deck = aDeck({
      maindeck: [{ cardId: sevenDwarves.oracleId, quantity: 7 }],
      sideboard: [],
    });
    const repo = await repoWith([sevenDwarves]);

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).not.toContain("exceeds-card-limit");
  });

  it("skips the copy-limit check for a card that failed to resolve — a false warning is worse than a missed one", async () => {
    const deck = aDeck({
      maindeck: [{ cardId: toCardId("card-unresolvable"), quantity: 20 }],
      sideboard: [],
    });
    const repo = await repoWith([]); // nothing resolved — peek() returns undefined for everything

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).not.toContain("exceeds-card-limit");
  });

  it("exempts basic lands from the copy limit even at high counts", async () => {
    const plains = aCard({
      oracleId: toCardId("card-plains"),
      name: "Plains",
      typeLine: "Basic Land — Plains",
    });
    const deck = aDeck({ maindeck: [{ cardId: plains.oracleId, quantity: 20 }], sideboard: [] });
    const repo = await repoWith([plains]);

    const issues = validateDeck(deck, repo);

    expect(issues.map((i) => i.code)).not.toContain("exceeds-card-limit");
  });
});
