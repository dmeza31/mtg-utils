/**
 * SPEC-C Task C-2 — matchup validity summary (FR-5.7). Precedence, highest
 * first: broken → unbalanced → incomplete → empty → valid.
 */
import { describe, expect, it } from "vitest";
import { aDeck, aMatchup } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { Matchup, PlanEntry } from "../model/types";
import type { PlanContext } from "./actions";
import { matchupStatus } from "./summary";

const bolt = toCardId("bolt");
const ctx: PlanContext = { deck: aDeck() };

function entry(overrides: Partial<PlanEntry> = {}): PlanEntry {
  return { cardId: bolt, quantity: 2, ...overrides };
}

describe("matchupStatus — one per status", () => {
  it("a matchup with no plan entries is empty", () => {
    const m = aMatchup({ plans: { unified: { out: [], in: [] } } });
    expect(matchupStatus(m, ctx)).toBe("empty");
  });

  it("a balanced plan with entries is valid", () => {
    const m = aMatchup({ plans: { unified: { out: [entry()], in: [entry()] } } });
    expect(matchupStatus(m, ctx)).toBe("valid");
  });

  it("unequal out/in totals is unbalanced", () => {
    const m = aMatchup({
      plans: { unified: { out: [entry({ quantity: 2 })], in: [entry({ quantity: 1 })] } },
    });
    expect(matchupStatus(m, ctx)).toBe("unbalanced");
  });

  it("a broken entry is broken", () => {
    const m = aMatchup({
      plans: { unified: { out: [entry({ broken: true })], in: [entry()] } },
    });
    expect(matchupStatus(m, ctx)).toBe("broken");
  });

  it("a split matchup where only onPlay is filled is incomplete", () => {
    const m = aMatchup({
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [entry()], in: [entry()] },
        onDraw: { out: [], in: [] },
      },
    });
    expect(matchupStatus(m, ctx)).toBe("incomplete");
  });

  it("a split matchup where only onDraw is filled is incomplete", () => {
    const m = aMatchup({
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [], in: [] },
        onDraw: { out: [entry()], in: [entry()] },
      },
    });
    expect(matchupStatus(m, ctx)).toBe("incomplete");
  });

  it("a split matchup where both variants are empty is empty, not incomplete", () => {
    const m: Matchup = aMatchup({
      splitPlayDraw: true,
      plans: { onPlay: { out: [], in: [] }, onDraw: { out: [], in: [] } },
    });
    expect(matchupStatus(m, ctx)).toBe("empty");
  });

  it("a split matchup where both variants are filled and balanced is valid", () => {
    const m = aMatchup({
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [entry()], in: [entry()] },
        onDraw: { out: [entry()], in: [entry()] },
      },
    });
    expect(matchupStatus(m, ctx)).toBe("valid");
  });
});

describe("matchupStatus — precedence", () => {
  it("broken outranks unbalanced when both apply", () => {
    const m = aMatchup({
      plans: {
        unified: {
          out: [entry({ quantity: 3, broken: true })],
          in: [entry({ quantity: 1 })],
        },
      },
    });
    expect(matchupStatus(m, ctx)).toBe("broken");
  });

  it("unbalanced outranks incomplete when both apply", () => {
    const m = aMatchup({
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [entry({ quantity: 2 })], in: [entry({ quantity: 1 })] },
        onDraw: { out: [], in: [] },
      },
    });
    expect(matchupStatus(m, ctx)).toBe("unbalanced");
  });
});
