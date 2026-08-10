/**
 * SPEC-002 Task 6 (FR-6.10). `postBoardDeck` previews the 75 after a
 * sideboard swap: OUT cards move maindeck → sideboard, IN cards move
 * sideboard → maindeck.
 */
import { describe, expect, it } from "vitest";
import { aDeck } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { Deck, SideboardPlan } from "../model/types";
import { postBoardDeck } from "./postBoard";

const bolt = toCardId("card-lightning-bolt");
const rip = toCardId("card-rest-in-peace");
const path = toCardId("card-path-to-exile");

describe("postBoardDeck (FR-6.10)", () => {
  it("cards fully boarded out disappear from the maindeck", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 4 }], in: [] };

    const result = postBoardDeck(deck, plan);

    expect(result.maindeck.find((e) => e.cardId === bolt)).toBeUndefined();
  });

  it("partial boards reduce quantity rather than removing the entry", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 2 }], in: [] };

    const result = postBoardDeck(deck, plan);

    expect(result.maindeck).toEqual([{ cardId: bolt, quantity: 2 }]);
  });

  it("boarded-in cards appear in the maindeck and are decremented from the sideboard", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 4 }],
      sideboard: [{ cardId: rip, quantity: 2 }],
    });
    const plan: SideboardPlan = { out: [], in: [{ cardId: rip, quantity: 2 }] };

    const result = postBoardDeck(deck, plan);

    expect(result.maindeck).toContainEqual({ cardId: rip, quantity: 2 });
    expect(result.sideboard.find((e) => e.cardId === rip)).toBeUndefined();
  });

  it("a partial board-in leaves the remainder in the sideboard", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 4 }],
      sideboard: [{ cardId: rip, quantity: 2 }],
    });
    const plan: SideboardPlan = { out: [], in: [{ cardId: rip, quantity: 1 }] };

    const result = postBoardDeck(deck, plan);

    expect(result.sideboard).toContainEqual({ cardId: rip, quantity: 1 });
  });

  it("a card present in both zones is handled correctly when boarded both ways", () => {
    const deck = aDeck({
      maindeck: [
        { cardId: bolt, quantity: 4 },
        { cardId: path, quantity: 2 },
      ],
      sideboard: [{ cardId: path, quantity: 1 }],
    });
    const plan: SideboardPlan = {
      out: [{ cardId: path, quantity: 1 }],
      in: [{ cardId: path, quantity: 1 }],
    };

    const result = postBoardDeck(deck, plan);

    // Net maindeck count for `path` is unchanged: one copy left, one came in.
    expect(result.maindeck.find((e) => e.cardId === path)?.quantity).toBe(2);
    expect(result.sideboard.find((e) => e.cardId === path)?.quantity).toBe(1);
  });

  it("the boarded-out card lands in the sideboard", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 1 }], in: [] };

    const result = postBoardDeck(deck, plan);

    expect(result.sideboard).toContainEqual({ cardId: bolt, quantity: 1 });
  });

  it("is pure — the input deck is never mutated", () => {
    const deck: Deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 4 }],
      sideboard: [{ cardId: rip, quantity: 2 }],
    });
    const before = JSON.parse(JSON.stringify(deck)) as Deck;
    const plan: SideboardPlan = {
      out: [{ cardId: bolt, quantity: 2 }],
      in: [{ cardId: rip, quantity: 2 }],
    };

    const result = postBoardDeck(deck, plan);

    expect(deck).toEqual(before);
    expect(result).not.toBe(deck);
  });

  it("an empty plan yields a deck with the same card counts", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 4 }],
      sideboard: [{ cardId: rip, quantity: 2 }],
    });
    const plan: SideboardPlan = { out: [], in: [] };

    const result = postBoardDeck(deck, plan);

    expect(result.maindeck).toEqual(deck.maindeck);
    expect(result.sideboard).toEqual(deck.sideboard);
  });
});
