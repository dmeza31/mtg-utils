/**
 * SPEC-C Task C-1 — matchup factory and operations (FR-5.1, FR-5.2, FR-5.5).
 * The `duplicateMatchup` aliasing test is the whole point of story C4: a
 * duplicate that shares a plan object with its source is a data-loss bug
 * that looks fine until the user edits it.
 */
import { describe, expect, it } from "vitest";
import { createIdFactory } from "./ids";
import { toCardId } from "./types";
import type { Matchup } from "./types";
import {
  copyPlanVariant,
  createMatchup,
  disableSplitPlayDraw,
  duplicateMatchup,
  enableSplitPlayDraw,
  renameMatchup,
  reorder,
} from "./matchup";

function countingIds() {
  let n = 0;
  return createIdFactory(() => `id-${(n += 1)}`);
}

describe("createMatchup (FR-5.1, FR-5.2)", () => {
  it("produces a matchup with an empty unified plan, no split, no game plan, no tags", () => {
    const m = createMatchup(countingIds(), "Izzet Murktide");
    expect(m).toEqual({
      id: "id-1",
      name: "Izzet Murktide",
      tags: [],
      gamePlan: "",
      splitPlayDraw: false,
      plans: { unified: { out: [], in: [] } },
    });
  });

  it("trims the name", () => {
    const m = createMatchup(countingIds(), "  Izzet Murktide  ");
    expect(m.name).toBe("Izzet Murktide");
  });

  it("rejects an all-whitespace name", () => {
    expect(() => createMatchup(countingIds(), "   ")).toThrow(/name/i);
  });

  it("rejects an empty name", () => {
    expect(() => createMatchup(countingIds(), "")).toThrow(/name/i);
  });
});

describe("renameMatchup (FR-5.5)", () => {
  const base = createMatchup(countingIds(), "Original");

  it("trims the new name", () => {
    expect(renameMatchup(base, "  New Name  ").name).toBe("New Name");
  });

  it("rejects an all-whitespace name", () => {
    expect(() => renameMatchup(base, "   ")).toThrow(/name/i);
  });

  it("does not mutate the source", () => {
    const renamed = renameMatchup(base, "New Name");
    expect(base.name).toBe("Original");
    expect(renamed).not.toBe(base);
  });
});

describe("duplicateMatchup (FR-5.5, story C4)", () => {
  it("gets a fresh id and is named '<name> (copy)'", () => {
    const ids = countingIds();
    const source = createMatchup(ids, "Original");
    const copy = duplicateMatchup(ids, source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe("Original (copy)");
  });

  it("deep-copies the plan — mutating the copy's plan leaves the source unchanged", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      plans: { unified: { out: [{ cardId: bolt, quantity: 2 }], in: [] } },
    };

    const copy = duplicateMatchup(ids, source);
    const mutatedCopyPlan = {
      ...copy.plans.unified!,
      out: [{ cardId: bolt, quantity: 4 }],
    };
    const mutatedCopy: Matchup = { ...copy, plans: { unified: mutatedCopyPlan } };

    expect(source.plans.unified!.out).toEqual([{ cardId: bolt, quantity: 2 }]);
    expect(mutatedCopy.plans.unified!.out).toEqual([{ cardId: bolt, quantity: 4 }]);
    // The real aliasing hazard: the copy's own out array must not be the
    // same array reference as the source's.
    expect(copy.plans.unified!.out).not.toBe(source.plans.unified!.out);
  });

  it("copies per-card notes", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      plans: { unified: { out: [{ cardId: bolt, quantity: 2, note: "vs removal" }], in: [] } },
    };
    const copy = duplicateMatchup(ids, source);
    expect(copy.plans.unified!.out[0]?.note).toBe("vs removal");
  });

  it("duplicates a matchup with split play/draw plans, copying both variants", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [{ cardId: bolt, quantity: 1 }], in: [] },
        onDraw: { out: [{ cardId: bolt, quantity: 2 }], in: [] },
      },
    };
    const copy = duplicateMatchup(ids, source);
    expect(copy.plans.onPlay!.out).toEqual([{ cardId: bolt, quantity: 1 }]);
    expect(copy.plans.onDraw!.out).toEqual([{ cardId: bolt, quantity: 2 }]);
    expect(copy.plans.onPlay!.out).not.toBe(source.plans.onPlay!.out);
    expect(copy.plans.onDraw!.out).not.toBe(source.plans.onDraw!.out);
  });

  it("carries game plan text across", () => {
    const ids = countingIds();
    const source: Matchup = { ...createMatchup(ids, "Original"), gamePlan: "**Race them.**" };
    expect(duplicateMatchup(ids, source).gamePlan).toBe("**Race them.**");
  });
});

describe("enableSplitPlayDraw (D-9, FR-6.8)", () => {
  it("seeds both onPlay and onDraw from the existing unified plan rather than starting empty", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      plans: { unified: { out: [{ cardId: bolt, quantity: 2 }], in: [] } },
    };

    const split = enableSplitPlayDraw(source);

    expect(split.splitPlayDraw).toBe(true);
    expect(split.plans.onPlay!.out).toEqual([{ cardId: bolt, quantity: 2 }]);
    expect(split.plans.onDraw!.out).toEqual([{ cardId: bolt, quantity: 2 }]);
  });

  it("the seeded variants don't alias each other or the unified plan", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      plans: { unified: { out: [{ cardId: bolt, quantity: 2 }], in: [] } },
    };

    const split = enableSplitPlayDraw(source);

    expect(split.plans.onPlay!.out).not.toBe(split.plans.onDraw!.out);
    expect(split.plans.onPlay!.out).not.toBe(source.plans.unified!.out);
  });

  it("treats a missing unified plan as empty rather than throwing", () => {
    const ids = countingIds();
    const source: Matchup = { ...createMatchup(ids, "Original"), plans: {} };
    const split = enableSplitPlayDraw(source);
    expect(split.plans.onPlay).toEqual({ out: [], in: [] });
    expect(split.plans.onDraw).toEqual({ out: [], in: [] });
  });
});

describe("disableSplitPlayDraw (D-9)", () => {
  it("keeps the chosen variant as the new unified plan", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [{ cardId: bolt, quantity: 1 }], in: [] },
        onDraw: { out: [{ cardId: bolt, quantity: 3 }], in: [] },
      },
    };

    const result = disableSplitPlayDraw(source, "onDraw");

    expect(result.splitPlayDraw).toBe(false);
    expect(result.plans.unified!.out).toEqual([{ cardId: bolt, quantity: 3 }]);
  });

  it("never discards silently — the discarded variant's data simply isn't chosen", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [{ cardId: bolt, quantity: 1 }], in: [] },
        onDraw: { out: [{ cardId: bolt, quantity: 3 }], in: [] },
      },
    };

    const result = disableSplitPlayDraw(source, "onPlay");
    expect(result.plans.unified!.out).toEqual([{ cardId: bolt, quantity: 1 }]);
  });
});

describe("copyPlanVariant (D-9)", () => {
  it("copies one variant's plan onto another, independent of the source afterwards", () => {
    const ids = countingIds();
    const bolt = toCardId("bolt");
    const source: Matchup = {
      ...createMatchup(ids, "Original"),
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [{ cardId: bolt, quantity: 1 }], in: [] },
        onDraw: { out: [], in: [] },
      },
    };

    const result = copyPlanVariant(source, "onPlay", "onDraw");

    expect(result.plans.onDraw!.out).toEqual([{ cardId: bolt, quantity: 1 }]);
    expect(result.plans.onDraw!.out).not.toBe(result.plans.onPlay!.out);
  });
});

describe("reorder", () => {
  const items = ["a", "b", "c", "d"];

  it("moves an item from one index to another", () => {
    expect(reorder(items, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("is a no-op when from === to", () => {
    expect(reorder(items, 1, 1)).toEqual(items);
  });

  it("handles moving the first item", () => {
    expect(reorder(items, 0, 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("handles moving the last item", () => {
    expect(reorder(items, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns the original array unchanged for an out-of-range 'from'", () => {
    expect(reorder(items, -1, 2)).toEqual(items);
    expect(reorder(items, 4, 2)).toEqual(items);
  });

  it("returns the original array unchanged for an out-of-range 'to'", () => {
    expect(reorder(items, 0, -1)).toEqual(items);
    expect(reorder(items, 0, 4)).toEqual(items);
  });

  it("never mutates the input array", () => {
    const original = [...items];
    reorder(items, 0, 2);
    expect(items).toEqual(original);
  });
});
