/**
 * SPEC-002 Task 9 / SPEC-C Task C-3. Tested directly against the vanilla
 * `createStore` — no React, no rendering. The store must hold no business
 * logic: `editPlan` just locates state and calls the domain function it's
 * given, and the matchup CRUD actions now delegate to
 * `src/domain/model/matchup.ts` (SPEC-C task C-1).
 */
import { describe, expect, it } from "vitest";
import { addOut } from "../domain/plan/actions";
import { createIdFactory } from "../domain/model/ids";
import { toCardId, toMatchupId } from "../domain/model/types";
import type { Deck } from "../domain/model/types";
import { createWorkspaceStore } from "./workspaceStore";

const bolt = toCardId("card-lightning-bolt");

const deck: Deck = {
  id: "deck-1",
  name: "Test Deck",
  format: "modern",
  maindeck: [{ cardId: bolt, quantity: 4 }],
  sideboard: [],
  importedAt: "2026-01-01T00:00:00.000Z",
  sourceText: "4 Lightning Bolt",
};

function countingSource(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `id-${n}`;
  };
}

function aStore() {
  return createWorkspaceStore(createIdFactory(countingSource()));
}

describe("workspaceStore (SPEC-002 Task 9)", () => {
  it("addMatchup returns a usable id and appends the matchup with an initialized unified plan", () => {
    const store = aStore();

    const id = store.getState().addMatchup("UR Murktide");

    expect(id).toBe("id-1");
    expect(store.getState().workspace.matchups).toEqual([
      {
        id: "id-1",
        name: "UR Murktide",
        tags: [],
        gamePlan: "",
        splitPlayDraw: false,
        plans: { unified: { out: [], in: [] } },
      },
    ]);
  });

  it("addMatchup rejects a whitespace-only name (FR-5.2)", () => {
    const store = aStore();
    expect(() => store.getState().addMatchup("   ")).toThrow(/name/i);
    expect(store.getState().workspace.matchups).toEqual([]);
  });

  it("duplicateMatchup deep-copies the plan so editing the copy doesn't touch the original", () => {
    const store = aStore();
    store.getState().setDeck(deck);
    const originalId = store.getState().addMatchup("Original");
    store.getState().editPlan(originalId, "unified", (plan, ctx) => addOut(plan, ctx, bolt, 2));

    const copyId = store.getState().duplicateMatchup(originalId);
    store.getState().editPlan(copyId, "unified", (plan, ctx) => addOut(plan, ctx, bolt, 2));

    const original = store.getState().workspace.matchups.find((m) => m.id === originalId);
    const copy = store.getState().workspace.matchups.find((m) => m.id === copyId);

    expect(original?.plans.unified?.out).toEqual([{ cardId: bolt, quantity: 2 }]);
    expect(copy?.plans.unified?.out).toEqual([{ cardId: bolt, quantity: 4 }]);
  });

  it("duplicateMatchup is a no-op that returns the input id when the matchup doesn't exist", () => {
    const store = aStore();

    const result = store.getState().duplicateMatchup(toMatchupId("nope"));

    expect(store.getState().workspace.matchups).toEqual([]);
    expect(result).toBeDefined();
  });

  it("removeMatchup followed by undo restores the matchup with its plans intact (FR-5.6)", () => {
    const store = aStore();
    store.getState().setDeck(deck);
    const id = store.getState().addMatchup("UR Murktide");
    store.getState().editPlan(id, "unified", (plan, ctx) => addOut(plan, ctx, bolt, 3));

    const beforeRemoval = store.getState().workspace;
    store.getState().removeMatchup(id);
    expect(store.getState().workspace.matchups).toEqual([]);

    store.temporal.getState().undo();

    expect(store.getState().workspace).toEqual(beforeRemoval);
  });

  it("editPlan on a nonexistent matchup is a no-op, not a throw", () => {
    const store = aStore();
    store.getState().setDeck(deck);
    const before = store.getState().workspace;

    expect(() => {
      store
        .getState()
        .editPlan(toMatchupId("does-not-exist"), "unified", (plan, ctx) =>
          addOut(plan, ctx, bolt, 1),
        );
    }).not.toThrow();
    expect(store.getState().workspace).toEqual(before);
  });

  it("editPlan without a deck set yet is a no-op", () => {
    const store = aStore();
    const id = store.getState().addMatchup("No Deck Yet");
    const before = store.getState().workspace;

    store.getState().editPlan(id, "unified", (plan, ctx) => addOut(plan, ctx, bolt, 1));

    expect(store.getState().workspace).toEqual(before);
  });

  it("renameMatchup updates the name of the matching matchup only", () => {
    const store = aStore();
    const first = store.getState().addMatchup("First");
    store.getState().addMatchup("Second");

    store.getState().renameMatchup(first, "Renamed");

    expect(store.getState().workspace.matchups.map((m) => m.name)).toEqual(["Renamed", "Second"]);
  });

  it("renameMatchup rejects a whitespace-only name (FR-5.2)", () => {
    const store = aStore();
    const id = store.getState().addMatchup("Original");
    expect(() => store.getState().renameMatchup(id, "   ")).toThrow(/name/i);
    expect(store.getState().workspace.matchups[0]?.name).toBe("Original");
  });

  it("reorderMatchups moves a matchup to a new position", () => {
    const store = aStore();
    store.getState().addMatchup("A");
    store.getState().addMatchup("B");
    store.getState().addMatchup("C");

    store.getState().reorderMatchups(0, 2);

    expect(store.getState().workspace.matchups.map((m) => m.name)).toEqual(["B", "C", "A"]);
  });

  it("setSplitPlayDraw and setGamePlan update only the targeted matchup", () => {
    const store = aStore();
    const id = store.getState().addMatchup("UR Murktide");

    store.getState().setSplitPlayDraw(id, true);
    store.getState().setGamePlan(id, "**Race** them.");

    const matchup = store.getState().workspace.matchups.find((m) => m.id === id);
    expect(matchup?.splitPlayDraw).toBe(true);
    expect(matchup?.gamePlan).toBe("**Race** them.");
  });

  it("undo/redo round-trips through the temporal middleware without touching status", () => {
    const store = aStore();
    store.getState().addMatchup("A");

    store.temporal.getState().undo();
    expect(store.getState().workspace.matchups).toEqual([]);
    expect(store.getState().status).toBe("empty");

    store.temporal.getState().redo();
    expect(store.getState().workspace.matchups).toHaveLength(1);
  });
});

describe("workspaceStore — selection (SPEC-C task C-3)", () => {
  it("starts with no matchup selected", () => {
    const store = aStore();
    expect(store.getState().selectedMatchupId).toBeUndefined();
  });

  it("addMatchup makes the new matchup the selected one", () => {
    const store = aStore();
    const first = store.getState().addMatchup("First");
    expect(store.getState().selectedMatchupId).toBe(first);

    const second = store.getState().addMatchup("Second");
    expect(store.getState().selectedMatchupId).toBe(second);
  });

  it("selectMatchup changes the selection to an existing matchup", () => {
    const store = aStore();
    const first = store.getState().addMatchup("First");
    const second = store.getState().addMatchup("Second");

    store.getState().selectMatchup(first);
    expect(store.getState().selectedMatchupId).toBe(first);
    void second;
  });

  it("selectMatchup on a nonexistent id is a no-op", () => {
    const store = aStore();
    const first = store.getState().addMatchup("First");

    store.getState().selectMatchup(toMatchupId("nope"));
    expect(store.getState().selectedMatchupId).toBe(first);
  });

  it("removing the selected matchup selects the neighbour at the same index", () => {
    const store = aStore();
    store.getState().addMatchup("A");
    store.getState().addMatchup("B");
    const c = store.getState().addMatchup("C");
    store.getState().selectMatchup(c);

    // Removing the last matchup (index 2, now with nothing after it) should
    // select its new neighbour — the matchup now at the end of the list.
    store.getState().removeMatchup(c);
    const remaining = store.getState().workspace.matchups;
    expect(store.getState().selectedMatchupId).toBe(remaining[remaining.length - 1]?.id);
  });

  it("removing a middle selected matchup selects the one now at its index", () => {
    const store = aStore();
    store.getState().addMatchup("A");
    const b = store.getState().addMatchup("B");
    store.getState().addMatchup("C");
    store.getState().selectMatchup(b);

    store.getState().removeMatchup(b);
    const remaining = store.getState().workspace.matchups.map((m) => m.name);
    expect(remaining).toEqual(["A", "C"]);
    const selected = store
      .getState()
      .workspace.matchups.find((m) => m.id === store.getState().selectedMatchupId);
    expect(selected?.name).toBe("C");
  });

  it("removing the last remaining matchup clears the selection", () => {
    const store = aStore();
    const only = store.getState().addMatchup("Only");
    store.getState().removeMatchup(only);
    expect(store.getState().selectedMatchupId).toBeUndefined();
  });

  it("removing a non-selected matchup leaves the selection untouched", () => {
    const store = aStore();
    const a = store.getState().addMatchup("A");
    const b = store.getState().addMatchup("B");
    store.getState().selectMatchup(a);

    store.getState().removeMatchup(b);
    expect(store.getState().selectedMatchupId).toBe(a);
  });
});

describe("workspaceStore — metadata (SPEC-C task C-6)", () => {
  it("setPriority and setTags update only the targeted matchup", () => {
    const store = aStore();
    const id = store.getState().addMatchup("UR Murktide");

    store.getState().setPriority(id, "high");
    store.getState().setTags(id, ["tempo", "aggro"]);

    const matchup = store.getState().workspace.matchups.find((m) => m.id === id);
    expect(matchup?.priority).toBe("high");
    expect(matchup?.tags).toEqual(["tempo", "aggro"]);
  });
});

describe("workspaceStore — opponent deck (SPEC-C task C-7)", () => {
  it("setOpponentDeck attaches a deck to the matchup without touching workspace.deck", () => {
    const store = aStore();
    const id = store.getState().addMatchup("UR Murktide");

    store.getState().setOpponentDeck(id, deck);

    const matchup = store.getState().workspace.matchups.find((m) => m.id === id);
    expect(matchup?.opponentDeck).toEqual(deck);
    expect(store.getState().workspace.deck).toBeUndefined();
  });

  it("removeOpponentDeck clears the opponent deck, leaving the matchup otherwise unchanged", () => {
    const store = aStore();
    const id = store.getState().addMatchup("UR Murktide");
    store.getState().setOpponentDeck(id, deck);

    store.getState().removeOpponentDeck(id);

    const matchup = store.getState().workspace.matchups.find((m) => m.id === id);
    expect(matchup?.opponentDeck).toBeUndefined();
    expect(matchup?.name).toBe("UR Murktide");
  });
});
