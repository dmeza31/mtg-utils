/**
 * SPEC-B Task B-3 — deck statistics (FR-3.8). Table-tested against a
 * hand-built deck: this is the cheapest, highest-value test file in the
 * project (per the spec's own framing) because every rule here is a
 * reasonable-people-implement-it-differently decision.
 */
import { describe, expect, it } from "vitest";
import { aCard, aDeck } from "../../../tests/support/builders";
import { FakeCardRepository } from "../../../tests/support/FakeCardRepository";
import { toCardId } from "../model/types";
import type { Card, Deck } from "../model/types";
import { computeStatistics } from "./statistics";

async function repoWith(cards: readonly Card[]): Promise<FakeCardRepository> {
  const repo = new FakeCardRepository(cards);
  await repo.resolve(cards.map((c) => ({ name: c.name })));
  return repo;
}

function card(overrides: Partial<Card>): Card {
  return aCard({ oracleId: toCardId(overrides.name ?? "card"), ...overrides });
}

function deckOf(
  maindeck: ReadonlyArray<[Card, number]>,
  sideboard: ReadonlyArray<[Card, number]> = [],
): Deck {
  return aDeck({
    maindeck: maindeck.map(([c, quantity]) => ({ cardId: c.oracleId, quantity })),
    sideboard: sideboard.map(([c, quantity]) => ({ cardId: c.oracleId, quantity })),
  });
}

describe("computeStatistics — totals", () => {
  it("counts totalMaindeck and totalSideboard from the deck directly", async () => {
    const bolt = card({ name: "Lightning Bolt", manaValue: 1, typeLine: "Instant" });
    const rip = card({ name: "Rest in Peace", manaValue: 2, typeLine: "Enchantment" });
    const repo = await repoWith([bolt, rip]);
    const deck = deckOf([[bolt, 4]], [[rip, 2]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.totalMaindeck).toBe(4);
    expect(stats.totalSideboard).toBe(2);
  });
});

describe("computeStatistics — mana curve", () => {
  it("excludes lands from the curve and from average mana value", async () => {
    const bolt = card({ name: "Lightning Bolt", manaValue: 1, typeLine: "Instant" });
    const forest = card({ name: "Forest", manaValue: 0, typeLine: "Basic Land — Forest" });
    const repo = await repoWith([bolt, forest]);
    const deck = deckOf([
      [bolt, 4],
      [forest, 20],
    ]);

    const stats = computeStatistics(deck, repo);
    expect(stats.manaCurve).toEqual([{ manaValue: 1, count: 4 }]);
    expect(stats.averageManaValue).toBe(1);
    expect(stats.landCount).toBe(20);
  });

  it("treats X as mana value 0", async () => {
    const fireball = card({
      name: "Fireball",
      manaValue: 0,
      manaCost: "{X}{R}",
      typeLine: "Sorcery",
    });
    const repo = await repoWith([fireball]);
    const deck = deckOf([[fireball, 4]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.manaCurve).toEqual([{ manaValue: 0, count: 4 }]);
  });

  it("split and modal cards count the front face's mana value for curve purposes", async () => {
    const mdfc = card({
      name: "Agadeem's Awakening",
      manaValue: 5, // Scryfall's own cmc for MDFCs already reflects the front face
      manaCost: "{3}{B}{B}",
      typeLine: "Sorcery // Land",
      faces: [
        { name: "Agadeem's Awakening", manaCost: "{3}{B}{B}", typeLine: "Sorcery" },
        { name: "Agadeem, the Undercrypt", typeLine: "Land" },
      ],
    });
    const repo = await repoWith([mdfc]);
    const deck = deckOf([[mdfc, 2]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.manaCurve).toEqual([{ manaValue: 5, count: 2 }]);
  });

  it("counts a twobrid symbol's numeric half toward a front face's mana value", async () => {
    const mdfc = card({
      name: "Twobrid Front",
      manaValue: 4,
      typeLine: "Sorcery // Land",
      faces: [
        { name: "Twobrid Front", manaCost: "{2/W}{2/W}", typeLine: "Sorcery" },
        { name: "Twobrid Back", typeLine: "Land" },
      ],
    });
    const repo = await repoWith([mdfc]);
    const deck = deckOf([[mdfc, 1]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.manaCurve).toEqual([{ manaValue: 4, count: 1 }]);
  });

  it("sums curve buckets ascending by mana value", async () => {
    const one = card({ name: "one", manaValue: 1, typeLine: "Instant" });
    const three = card({ name: "three", manaValue: 3, typeLine: "Sorcery" });
    const repo = await repoWith([one, three]);
    const deck = deckOf([
      [three, 2],
      [one, 4],
    ]);

    const stats = computeStatistics(deck, repo);
    expect(stats.manaCurve).toEqual([
      { manaValue: 1, count: 4 },
      { manaValue: 3, count: 2 },
    ]);
  });
});

describe("computeStatistics — colour pips", () => {
  it("counts pips per copy, not per distinct card (4x {U}{U} is 8 blue pips)", async () => {
    const counterspell = card({ name: "Counterspell", manaCost: "{U}{U}", typeLine: "Instant" });
    const repo = await repoWith([counterspell]);
    const deck = deckOf([[counterspell, 4]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.colorPips.find((p) => p.color === "U")?.count).toBe(8);
  });

  it("hybrid pips count toward both colours", async () => {
    const boros = card({ name: "Boros Charm", manaCost: "{R/W}", typeLine: "Instant" });
    const repo = await repoWith([boros]);
    const deck = deckOf([[boros, 1]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.colorPips.find((p) => p.color === "R")?.count).toBe(1);
    expect(stats.colorPips.find((p) => p.color === "W")?.count).toBe(1);
  });

  it("generic mana is not a pip", async () => {
    const bolt = card({ name: "Bolt", manaCost: "{1}{1}{R}", typeLine: "Instant" });
    const repo = await repoWith([bolt]);
    const deck = deckOf([[bolt, 1]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.colorPips.find((p) => p.color === "R")?.count).toBe(1);
    const total = stats.colorPips.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBe(1);
  });
});

describe("computeStatistics — type breakdown", () => {
  it("flags split/modal cards under the front face's type", async () => {
    const mdfc = card({
      name: "Agadeem's Awakening",
      typeLine: "Sorcery // Land",
      faces: [
        { name: "Agadeem's Awakening", typeLine: "Sorcery" },
        { name: "Agadeem, the Undercrypt", typeLine: "Land" },
      ],
    });
    const repo = await repoWith([mdfc]);
    const deck = deckOf([[mdfc, 2]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.typeBreakdown).toEqual([{ type: "Sorcery", count: 2 }]);
  });

  it("an Artifact Creature is counted under Creature", async () => {
    const golem = card({ name: "Golem", typeLine: "Artifact Creature — Golem" });
    const repo = await repoWith([golem]);
    const deck = deckOf([[golem, 3]]);

    const stats = computeStatistics(deck, repo);
    expect(stats.typeBreakdown).toEqual([{ type: "Creature", count: 3 }]);
  });
});

describe("computeStatistics — unresolved cards", () => {
  it("excludes an unresolved card from statistics rather than counting it as a 0-drop", async () => {
    const bolt = card({ name: "Lightning Bolt", manaValue: 1, typeLine: "Instant" });
    const repo = await repoWith([bolt]);
    const deck = deckOf([
      [bolt, 4],
      [card({ name: "Unresolved" }), 2],
    ]);

    const stats = computeStatistics(deck, repo);
    expect(stats.manaCurve).toEqual([{ manaValue: 1, count: 4 }]);
    expect(stats.unresolvedCount).toBe(2);
  });
});
