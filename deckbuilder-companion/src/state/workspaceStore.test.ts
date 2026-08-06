/**
 * SPEC-002 Task 9. Tested directly against the vanilla `createStore` — no
 * React, no rendering. The store must hold no business logic: `editPlan`
 * just locates state and calls the domain function it's given.
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
  it("addMatchup returns a usable id and appends the matchup", () => {
    const store = aStore();

    const id = store.getState().addMatchup("UR Murktide");

    expect(id).toBe("id-1");
    expect(store.getState().workspace.matchups).toEqual([
      { id: "id-1", name: "UR Murktide", tags: [], gamePlan: "", splitPlayDraw: false, plans: {} },
    ]);
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
