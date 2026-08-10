/**
 * SPEC-002 Task 5 (FR-7.2, FR-7.3, FR-7.6, FR-6.9). Each case here is named
 * as one row of the "Tests to write first" list in the spec, so a reviewer
 * can check this file against that list directly.
 */
import { describe, expect, it } from "vitest";
import { aDeck } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { SideboardPlan } from "../model/types";
import type { PlanContext } from "./actions";
import { validatePlan } from "./validate";

const bolt = toCardId("card-lightning-bolt");
const rip = toCardId("card-rest-in-peace");
const goneCard = toCardId("card-no-longer-in-deck");

function deckWithMaindeckSize(size: number): PlanContext {
  return {
    deck: aDeck({
      maindeck: [{ cardId: bolt, quantity: size }],
      sideboard: [{ cardId: rip, quantity: 15 }],
    }),
  };
}

describe("validatePlan (FR-7)", () => {
  it("empty plan: 'empty' issue, isValid false, postBoardSize equals maindeck size", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = { out: [], in: [] };

    const result = validatePlan(plan, ctx);

    expect(result.issues.map((i) => i.code)).toContain("empty");
    expect(result.isValid).toBe(false);
    expect(result.postBoardSize).toBe(60);
  });

  it("balanced 3-for-3: no issues, isValid true", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = {
      out: [{ cardId: bolt, quantity: 3 }],
      in: [{ cardId: rip, quantity: 3 }],
    };

    const result = validatePlan(plan, ctx);

    expect(result.issues).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it("2 out / 3 in: 'unbalanced', message names the delta explicitly (FR-7.2)", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = {
      out: [{ cardId: bolt, quantity: 2 }],
      in: [{ cardId: rip, quantity: 3 }],
    };

    const result = validatePlan(plan, ctx);

    const unbalanced = result.issues.find((i) => i.code === "unbalanced");
    expect(unbalanced?.message).toContain("2 out, 3 in");
    expect(unbalanced?.message).toContain("1 too many");
  });

  it("3 out / 2 in on a 60-card deck: both 'unbalanced' and 'under-minimum-deck'", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = {
      out: [{ cardId: bolt, quantity: 3 }],
      in: [{ cardId: rip, quantity: 2 }],
    };

    const result = validatePlan(plan, ctx);

    expect(result.issues.map((i) => i.code).sort()).toEqual(["unbalanced", "under-minimum-deck"]);
  });

  it("61-card maindeck, 3 out / 2 in: 'unbalanced' but NOT 'under-minimum-deck' (post-board 60)", () => {
    const ctx = deckWithMaindeckSize(61);
    const plan: SideboardPlan = {
      out: [{ cardId: bolt, quantity: 3 }],
      in: [{ cardId: rip, quantity: 2 }],
    };

    const result = validatePlan(plan, ctx);

    expect(result.postBoardSize).toBe(60);
    expect(result.issues.map((i) => i.code)).toEqual(["unbalanced"]);
  });

  it("a plan entry referencing a card no longer in the deck: 'broken-reference' with cardId set (FR-6.9)", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = {
      out: [{ cardId: goneCard, quantity: 1 }],
      in: [{ cardId: goneCard, quantity: 1 }],
    };

    const result = validatePlan(plan, ctx);

    const broken = result.issues.filter((i) => i.code === "broken-reference");
    expect(broken).toHaveLength(2);
    expect(broken.every((i) => i.cardId === goneCard)).toBe(true);
  });

  it("isValid=false never prevents construction of the validation result (FR-7.6)", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = { out: [], in: [] };

    expect(() => validatePlan(plan, ctx)).not.toThrow();
  });

  it("an entry that exceeds the maindeck copies is flagged (defence in depth, FR-6.3)", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = {
      out: [{ cardId: bolt, quantity: 999 }],
      in: [],
    };

    const result = validatePlan(plan, ctx);

    expect(result.issues.map((i) => i.code)).toContain("exceeds-maindeck");
  });

  it("an entry that exceeds the sideboard copies is flagged (defence in depth, FR-6.4)", () => {
    const ctx = deckWithMaindeckSize(60);
    const plan: SideboardPlan = {
      out: [],
      in: [{ cardId: rip, quantity: 999 }],
    };

    const result = validatePlan(plan, ctx);

    expect(result.issues.map((i) => i.code)).toContain("exceeds-sideboard");
  });
});
