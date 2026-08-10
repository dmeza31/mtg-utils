/**
 * SPEC-002 Task 4 — this is the core of the product; test it hardest. Every
 * row of the invariant table in SPEC-002 §Task 4 is one `it` block here,
 * numbered to match. FR-6.3, FR-6.4, FR-6.5, FR-6.7, FR-7.4, FR-9.3.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aDeck } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { SideboardPlan } from "../model/types";
import type { PlanContext } from "./actions";
import { addIn, addOut, clearPlan, setEntryNote, setInQuantity, setOutQuantity } from "./actions";

const bolt = toCardId("card-lightning-bolt");
const rip = toCardId("card-rest-in-peace");

const deck = aDeck({
  maindeck: [{ cardId: bolt, quantity: 4 }],
  sideboard: [{ cardId: rip, quantity: 2 }],
});
const ctx: PlanContext = { deck };

const emptyPlan: SideboardPlan = { out: [], in: [] };

describe("plan actions", () => {
  it("(1) returns a new object; the input plan is never mutated", () => {
    const before = JSON.parse(JSON.stringify(emptyPlan)) as typeof emptyPlan;

    const result = addOut(emptyPlan, ctx, bolt);

    expect(result).not.toBe(emptyPlan);
    expect(emptyPlan).toEqual(before);
  });

  it("(2) OUT quantity is clamped to [0, copies in maindeck] (FR-6.3, FR-9.3)", () => {
    const result = setOutQuantity(emptyPlan, ctx, bolt, 99);
    expect(result.out).toEqual([{ cardId: bolt, quantity: 4 }]);
  });

  it("(2) OUT quantity never goes negative", () => {
    const result = setOutQuantity(emptyPlan, ctx, bolt, -5);
    expect(result.out).toEqual([]);
  });

  it("(3) IN quantity is clamped to [0, copies in sideboard] (FR-6.4, FR-9.3)", () => {
    const result = setInQuantity(emptyPlan, ctx, rip, 99);
    expect(result.in).toEqual([{ cardId: rip, quantity: 2 }]);
  });

  it("(4) clamping is silent — it does not throw (FR-7.4)", () => {
    expect(() => setOutQuantity(emptyPlan, ctx, bolt, 99)).not.toThrow();
    expect(() => addIn(emptyPlan, ctx, rip, 99)).not.toThrow();
  });

  it("(5) setting quantity to 0 removes the entry rather than leaving a zero-quantity row", () => {
    const withEntry = setOutQuantity(emptyPlan, ctx, bolt, 2);
    const result = setOutQuantity(withEntry, ctx, bolt, 0);
    expect(result.out).toEqual([]);
  });

  it("(6) a card in both zones is tracked independently in out and in (FR-6.5)", () => {
    const bothZonesDeck = aDeck({
      maindeck: [{ cardId: bolt, quantity: 3 }],
      sideboard: [{ cardId: bolt, quantity: 1 }],
    });
    const bothZonesCtx: PlanContext = { deck: bothZonesDeck };

    const outOnly = setOutQuantity(emptyPlan, bothZonesCtx, bolt, 2);
    const result = setInQuantity(outOnly, bothZonesCtx, bolt, 1);

    expect(result.out).toEqual([{ cardId: bolt, quantity: 2 }]);
    expect(result.in).toEqual([{ cardId: bolt, quantity: 1 }]);
  });

  it("(7) a card with 0 copies in the relevant zone is a no-op (FR-6.3/6.4)", () => {
    const notInSideboard = toCardId("card-not-in-sideboard");
    const result = addIn(emptyPlan, ctx, notInSideboard, 1);
    expect(result.in).toEqual([]);
  });

  it("(8) adding to an existing entry sums, then re-clamps after summing", () => {
    const once = addOut(emptyPlan, ctx, bolt, 3);
    const twice = addOut(once, ctx, bolt, 3);
    expect(twice.out).toEqual([{ cardId: bolt, quantity: 4 }]);
  });

  it("(9) notes survive quantity changes", () => {
    const withEntry = setOutQuantity(emptyPlan, ctx, bolt, 2);
    const withNote = setEntryNote(withEntry, "out", bolt, "leave in vs control");
    const requantified = setOutQuantity(withNote, ctx, bolt, 3);
    expect(requantified.out).toEqual([{ cardId: bolt, quantity: 3, note: "leave in vs control" }]);
  });

  it("setEntryNote on the 'in' side updates only that side", () => {
    const withEntry = setInQuantity(emptyPlan, ctx, rip, 1);
    const withNote = setEntryNote(withEntry, "in", rip, "bring in vs graveyard decks");
    expect(withNote.in).toEqual([
      { cardId: rip, quantity: 1, note: "bring in vs graveyard decks" },
    ]);
  });

  it("updating one entry leaves other entries in the same zone untouched", () => {
    const twoCardDeck = aDeck({
      maindeck: [
        { cardId: bolt, quantity: 4 },
        { cardId: rip, quantity: 2 },
      ],
    });
    const twoCardCtx: PlanContext = { deck: twoCardDeck };

    const both = setOutQuantity(setOutQuantity(emptyPlan, twoCardCtx, bolt, 2), twoCardCtx, rip, 1);
    const updated = setOutQuantity(both, twoCardCtx, bolt, 3);

    expect(updated.out).toEqual([
      { cardId: bolt, quantity: 3 },
      { cardId: rip, quantity: 1 },
    ]);
  });

  it("setEntryNote leaves other entries' notes untouched", () => {
    const twoCardDeck = aDeck({
      maindeck: [
        { cardId: bolt, quantity: 4 },
        { cardId: rip, quantity: 2 },
      ],
    });
    const twoCardCtx: PlanContext = { deck: twoCardDeck };
    const both = setOutQuantity(setOutQuantity(emptyPlan, twoCardCtx, bolt, 2), twoCardCtx, rip, 1);

    const result = setEntryNote(both, "out", bolt, "bolt note");

    expect(result.out).toEqual([
      { cardId: bolt, quantity: 2, note: "bolt note" },
      { cardId: rip, quantity: 1 },
    ]);
  });

  it("(9) removing an entry removes its note", () => {
    const withEntry = setOutQuantity(emptyPlan, ctx, bolt, 2);
    const withNote = setEntryNote(withEntry, "out", bolt, "leave in vs control");
    const removed = setOutQuantity(withNote, ctx, bolt, 0);
    expect(removed.out).toEqual([]);
  });

  it("clearPlan empties both zones without mutating the input", () => {
    const withEntry = setOutQuantity(emptyPlan, ctx, bolt, 2);
    const cleared = clearPlan(withEntry);
    expect(cleared).toEqual({ out: [], in: [] });
    expect(withEntry.out).toEqual([{ cardId: bolt, quantity: 2 }]);
  });

  it("property: no sequence of actions ever pushes a quantity past the available copies", () => {
    const cardIds = [bolt, rip];
    const action = fc.record({
      side: fc.constantFrom("out", "in"),
      cardId: fc.constantFrom(...cardIds),
      qty: fc.integer({ min: -10, max: 10 }),
      mode: fc.constantFrom("add", "set"),
    });

    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
        let plan: SideboardPlan = emptyPlan;
        for (const step of actions) {
          if (step.side === "out") {
            plan =
              step.mode === "add"
                ? addOut(plan, ctx, step.cardId, step.qty)
                : setOutQuantity(plan, ctx, step.cardId, step.qty);
          } else {
            plan =
              step.mode === "add"
                ? addIn(plan, ctx, step.cardId, step.qty)
                : setInQuantity(plan, ctx, step.cardId, step.qty);
          }
        }

        for (const entry of plan.out) {
          expect(entry.quantity).toBeGreaterThanOrEqual(0);
          expect(entry.quantity).toBeLessThanOrEqual(4);
        }
        for (const entry of plan.in) {
          expect(entry.quantity).toBeGreaterThanOrEqual(0);
          expect(entry.quantity).toBeLessThanOrEqual(2);
        }
      }),
    );
  });
});
