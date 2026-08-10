/**
 * SPEC-002 Task 8 (FR-6.9, story A4) — the subtle one. Rule 3 (keep a broken
 * entry, never delete it) is the requirement most likely to be implemented
 * wrong by reflex, so its test is written to fail loudly if someone
 * "simplifies" a kept-but-broken entry into a deletion.
 */
import { describe, expect, it } from "vitest";
import { aDeck } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { SideboardPlan } from "../model/types";
import { reconcilePlan } from "./reconcile";

const bolt = toCardId("card-lightning-bolt");
const rip = toCardId("card-rest-in-peace");

describe("reconcilePlan (FR-6.9)", () => {
  it("(1) a card still present at ≥ the planned quantity is unchanged", () => {
    const oldDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const newDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 3 }], in: [] };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    expect(result.plan.out).toEqual([{ cardId: bolt, quantity: 3 }]);
    expect(result.changes).toEqual([]);
  });

  it("(2) a card present at a lower quantity is clamped down and reported 'reduced'", () => {
    const oldDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const newDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 2 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 4 }], in: [] };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    expect(result.plan.out).toEqual([{ cardId: bolt, quantity: 2 }]);
    expect(result.changes).toEqual([
      { kind: "reduced", side: "out", cardId: bolt, from: 4, to: 2 },
    ]);
  });

  it("(3) a card gone entirely from the deck is KEPT and marked broken, not deleted", () => {
    const oldDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const newDeck = aDeck({ maindeck: [], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 4 }], in: [] };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    // The entry must still be present — this is the assertion that fails if
    // "broken" is ever reflexively re-implemented as a delete.
    expect(result.plan.out).toHaveLength(1);
    expect(result.plan.out[0]).toMatchObject({ cardId: bolt, quantity: 4, broken: true });
    expect(result.changes).toEqual([{ kind: "broken", side: "out", cardId: bolt, from: 4, to: 0 }]);
  });

  it("(4) a card moved from maindeck to sideboard is kept, marked broken for that side, reported 'moved'", () => {
    const oldDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const newDeck = aDeck({ maindeck: [], sideboard: [{ cardId: bolt, quantity: 4 }] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 4 }], in: [] };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    expect(result.plan.out).toHaveLength(1);
    expect(result.plan.out[0]).toMatchObject({ cardId: bolt, quantity: 4, broken: true });
    expect(result.changes).toEqual([{ kind: "moved", side: "out", cardId: bolt, from: 4, to: 0 }]);
  });

  it("(5) reconciliation never invents entries for cards newly present in the deck", () => {
    const oldDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const newDeck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 4 }],
      sideboard: [{ cardId: rip, quantity: 2 }],
    });
    const plan: SideboardPlan = { out: [], in: [] };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    expect(result.plan).toEqual({ out: [], in: [] });
    expect(result.changes).toEqual([]);
  });

  it("clears a stale 'broken' flag once the card is available again in sufficient quantity", () => {
    const oldDeck = aDeck({ maindeck: [], sideboard: [] });
    const newDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 4 }], sideboard: [] });
    const plan: SideboardPlan = { out: [{ cardId: bolt, quantity: 4, broken: true }], in: [] };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    expect(result.plan.out).toEqual([{ cardId: bolt, quantity: 4 }]);
  });

  it("preserves a note through every outcome (reduced, broken, and unchanged)", () => {
    const oldDeck = aDeck({
      maindeck: [
        { cardId: bolt, quantity: 4 },
        { cardId: rip, quantity: 4 },
      ],
      sideboard: [],
    });
    const newDeck = aDeck({ maindeck: [{ cardId: bolt, quantity: 2 }], sideboard: [] });
    const plan: SideboardPlan = {
      out: [
        { cardId: bolt, quantity: 4, note: "reduced note" },
        { cardId: rip, quantity: 4, note: "broken note" },
      ],
      in: [],
    };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    expect(result.plan.out).toEqual([
      { cardId: bolt, quantity: 2, note: "reduced note" },
      { cardId: rip, quantity: 4, note: "broken note", broken: true },
    ]);
  });

  it("reconciles the IN side against the sideboard zone independently of OUT", () => {
    const oldDeck = aDeck({ maindeck: [], sideboard: [{ cardId: rip, quantity: 2 }] });
    const newDeck = aDeck({ maindeck: [], sideboard: [] });
    const plan: SideboardPlan = { out: [], in: [{ cardId: rip, quantity: 2 }] };

    const result = reconcilePlan(plan, oldDeck, newDeck);

    expect(result.plan.in[0]).toMatchObject({ cardId: rip, quantity: 2, broken: true });
    expect(result.changes).toEqual([{ kind: "broken", side: "in", cardId: rip, from: 2, to: 0 }]);
  });
});
