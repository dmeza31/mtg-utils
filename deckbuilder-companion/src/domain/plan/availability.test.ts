/**
 * SPEC-D Task D-1 — the single source of truth for "what can the user do
 * right now" (FR-7.4). Tests here are the six bullets from the spec,
 * verbatim.
 */
import { describe, expect, it } from "vitest";
import { aDeck } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { SideboardPlan } from "../model/types";
import { maindeckAvailability, sideboardAvailability } from "./availability";

const bolt = toCardId("card-lightning-bolt");
const rip = toCardId("card-rest-in-peace");
const ghost = toCardId("card-not-in-deck");

const emptyPlan: SideboardPlan = { out: [], in: [] };

describe("availability projections", () => {
  it("a 4-of with 2 boarded out -> remaining: 2, canAdd: true, canRemove: true", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 2 }], in: [] };

    const [availability] = maindeckAvailability(deck, plan);

    expect(availability).toEqual({
      cardId: bolt,
      inDeck: 4,
      planned: 2,
      remaining: 2,
      canAdd: true,
      canRemove: true,
    });
  });

  it("a 4-of fully boarded out -> remaining: 0, canAdd: false", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 4 }], in: [] };

    const [availability] = maindeckAvailability(deck, plan);

    expect(availability?.remaining).toBe(0);
    expect(availability?.canAdd).toBe(false);
  });

  it("nothing planned -> canRemove: false", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });

    const [availability] = maindeckAvailability(deck, emptyPlan);

    expect(availability?.canRemove).toBe(false);
  });

  it("a card in both zones appears in both projections with independent numbers (FR-6.5)", () => {
    const deck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 3 }],
      sideboard: [{ cardId: bolt, quantity: 1 }],
    });
    const plan: SideboardPlan = {
      out: [{ cardId: bolt, quantity: 1 }],
      in: [{ cardId: bolt, quantity: 1 }],
    };

    const [maindeckEntry] = maindeckAvailability(deck, plan);
    const [sideboardEntry] = sideboardAvailability(deck, plan);

    expect(maindeckEntry).toEqual({
      cardId: bolt,
      inDeck: 3,
      planned: 1,
      remaining: 2,
      canAdd: true,
      canRemove: true,
    });
    expect(sideboardEntry).toEqual({
      cardId: bolt,
      inDeck: 1,
      planned: 1,
      remaining: 0,
      canAdd: false,
      canRemove: true,
    });
  });

  it("a plan entry for a card not in the deck -> inDeck: 0, remaining: 0, canRemove: true", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: ghost, quantity: 1 }], in: [] };

    const availability = maindeckAvailability(deck, plan).find((a) => a.cardId === ghost);

    expect(availability).toEqual({
      cardId: ghost,
      inDeck: 0,
      planned: 1,
      remaining: 0,
      canAdd: false,
      canRemove: true,
    });
  });

  it("remaining is never negative even with an over-quantity entry from a stale reconcile", () => {
    const deck = aDeck({ maindeck: [{ cardId: bolt, quantity: 2 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 5 }], in: [] };

    const [availability] = maindeckAvailability(deck, plan);

    expect(availability?.remaining).toBe(0);
    expect(availability?.canAdd).toBe(false);
  });

  it("sideboardAvailability mirrors maindeckAvailability using IN entries against sideboard copies", () => {
    const deck = aDeck({ maindeck: [], sideboard: [{ cardId: rip, quantity: 2 }] });
    const plan: SideboardPlan = { out: [], in: [{ cardId: rip, quantity: 1 }] };

    const [availability] = sideboardAvailability(deck, plan);

    expect(availability).toEqual({
      cardId: rip,
      inDeck: 2,
      planned: 1,
      remaining: 1,
      canAdd: true,
      canRemove: true,
    });
  });
});
