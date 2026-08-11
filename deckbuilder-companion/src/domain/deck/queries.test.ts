/**
 * SPEC-002 Task 3 (FR-6.5). Small, total, no-I/O deck queries. The
 * per-zone independence case matters more than it looks: getting it wrong
 * here poisons all of SPEC-D's sideboard-plan clamping.
 */
import { describe, expect, it } from "vitest";
import { aCard, aDeck } from "../../../tests/support/builders";
import { FakeCardRepository } from "../../../tests/support/FakeCardRepository";
import { toCardId } from "../model/types";
import { copiesOf, countCards, distinctCardIds, resolveEntries, totalCopiesIn75 } from "./queries";

const bolt = toCardId("card-lightning-bolt");
const rip = toCardId("card-rest-in-peace");
const unseen = toCardId("card-never-in-deck");

describe("countCards (FR-6.5)", () => {
  it("returns 0 for an empty entry list", () => {
    expect(countCards([])).toBe(0);
  });

  it("sums quantities across entries", () => {
    expect(
      countCards([
        { cardId: bolt, quantity: 4 },
        { cardId: rip, quantity: 2 },
      ]),
    ).toBe(6);
  });

  it("sums multiple entries of the same card rather than counting entries (parser already merges, this is defence in depth)", () => {
    expect(
      countCards([
        { cardId: bolt, quantity: 2 },
        { cardId: bolt, quantity: 2 },
      ]),
    ).toBe(4);
  });
});

describe("copiesOf (FR-6.5)", () => {
  it("returns 0 when the card is not in the given zone", () => {
    const deck = aDeck();
    expect(copiesOf(deck, unseen, "maindeck")).toBe(0);
  });

  it("returns the quantity in the requested zone", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 4 }],
      sideboard: [{ cardId: rip, quantity: 2 }],
    });
    expect(copiesOf(deck, bolt, "maindeck")).toBe(4);
    expect(copiesOf(deck, rip, "sideboard")).toBe(2);
  });

  it("counts a card present in both zones independently per zone (FR-6.5)", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 3 }],
      sideboard: [{ cardId: bolt, quantity: 1 }],
    });
    expect(copiesOf(deck, bolt, "maindeck")).toBe(3);
    expect(copiesOf(deck, bolt, "sideboard")).toBe(1);
  });
});

describe("totalCopiesIn75 (FR-6.5)", () => {
  it("sums a card's copies across both zones", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 3 }],
      sideboard: [{ cardId: bolt, quantity: 1 }],
    });
    expect(totalCopiesIn75(deck, bolt)).toBe(4);
  });

  it("returns 0 for a card in neither zone", () => {
    expect(totalCopiesIn75(aDeck(), unseen)).toBe(0);
  });
});

describe("distinctCardIds", () => {
  it("returns an empty list for an empty deck", () => {
    const deck = aDeck({ maindeck: [], sideboard: [] });
    expect(distinctCardIds(deck)).toEqual([]);
  });

  it("returns each card once, even when it appears in both zones", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 3 }],
      sideboard: [
        { cardId: bolt, quantity: 1 },
        { cardId: rip, quantity: 2 },
      ],
    });
    expect(distinctCardIds(deck)).toEqual([bolt, rip]);
  });
});

describe("resolveEntries (SPEC-B task B-1 foundation)", () => {
  it("joins each entry in the given zone with its resolved Card", async () => {
    const boltCard = aCard({ oracleId: bolt, name: "Lightning Bolt" });
    const repo = new FakeCardRepository([boltCard]);
    await repo.resolve([{ name: "Lightning Bolt" }]);

    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    expect(resolveEntries(deck, "maindeck", repo)).toEqual([
      { cardId: bolt, card: boltCard, quantity: 4, zone: "maindeck" },
    ]);
  });

  it("excludes an entry whose card is unresolved (peek returns undefined)", async () => {
    const repo = new FakeCardRepository([]);
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    expect(resolveEntries(deck, "maindeck", repo)).toEqual([]);
  });

  it("only returns entries from the requested zone", async () => {
    const boltCard = aCard({ oracleId: bolt, name: "Lightning Bolt" });
    const ripCard = aCard({ oracleId: rip, name: "Rest in Peace" });
    const repo = new FakeCardRepository([boltCard, ripCard]);
    await repo.resolve([{ name: "Lightning Bolt" }, { name: "Rest in Peace" }]);

    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 4 }],
      sideboard: [{ cardId: rip, quantity: 2 }],
    });
    expect(resolveEntries(deck, "sideboard", repo)).toEqual([
      { cardId: rip, card: ripCard, quantity: 2, zone: "sideboard" },
    ]);
  });
});
