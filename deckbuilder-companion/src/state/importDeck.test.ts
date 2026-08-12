/**
 * SPEC-A Task A-9 — import orchestration: parse → resolve → build Deck →
 * validate (previewImport, no commit) → setDeck → reconcile plans
 * (commitImport). Uses `FakeCardRepository` (no network) exactly like
 * SPEC-002's own store tests.
 */
import { describe, expect, it } from "vitest";
import { addOut } from "../domain/plan/actions";
import { createIdFactory } from "../domain/model/ids";
import { toCardId } from "../domain/model/types";
import type { Card } from "../domain/model/types";
import { FakeCardRepository } from "../../tests/support/FakeCardRepository";
import { createWorkspaceStore } from "./workspaceStore";
import { commitImport, previewImport } from "./importDeck";

function aCard(overrides: Partial<Card> = {}): Card {
  return {
    oracleId: toCardId(overrides.name?.toLowerCase().replace(/\s+/g, "-") ?? "card"),
    name: "Card",
    manaValue: 1,
    typeLine: "Instant",
    colors: [],
    colorIdentity: [],
    rarity: "common",
    set: "lea",
    collectorNumber: "1",
    layout: "normal",
    cachedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function countingSource(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `id-${n}`;
  };
}

function setup(catalog: readonly Card[], suggestions: Readonly<Record<string, string>> = {}) {
  const store = createWorkspaceStore(createIdFactory(countingSource()));
  const repository = new FakeCardRepository(catalog, suggestions);
  const idFactory = createIdFactory(countingSource());
  return { store, repository, idFactory };
}

const bolt = aCard({ name: "Lightning Bolt" });
const swiftspear = aCard({ name: "Monastery Swiftspear" });
const mountain = aCard({ name: "Mountain", typeLine: "Basic Land — Mountain" });

describe("previewImport", () => {
  it("parses and resolves without touching the store's committed deck (FR-1.5)", async () => {
    const { store, repository, idFactory } = setup([bolt, swiftspear, mountain]);

    const preview = await previewImport(
      store,
      repository,
      idFactory,
      "4 Lightning Bolt\n4 Monastery Swiftspear\n52 Mountain",
    );

    expect(preview.status).toBe("ready");
    expect(preview.unresolved).toEqual([]);
    expect(preview.issues).toEqual([]);
    expect(preview.deck?.maindeck).toEqual([
      { cardId: bolt.oracleId, quantity: 4 },
      { cardId: swiftspear.oracleId, quantity: 4 },
      { cardId: mountain.oracleId, quantity: 52 },
    ]);
    // Nothing committed yet.
    expect(store.getState().workspace.deck).toBeUndefined();
    expect(store.getState().status).toBe("ready");
  });

  it("reports unresolved names without failing the rest of the preview (status partial)", async () => {
    const { store, repository, idFactory } = setup([bolt, swiftspear], {
      "Lightnin Bolt": "Lightning Bolt",
    });

    const preview = await previewImport(
      store,
      repository,
      idFactory,
      "4 Lightnin Bolt\n4 Monastery Swiftspear",
    );

    expect(preview.status).toBe("partial");
    expect(preview.unresolved).toEqual([
      { name: "Lightnin Bolt", reason: "not found", suggestion: "Lightning Bolt" },
    ]);
    expect(preview.deck?.maindeck).toEqual([{ cardId: swiftspear.oracleId, quantity: 4 }]);
  });

  it("flags a deck validation issue as status partial (FR-4.4 — never blocking)", async () => {
    const { store, repository, idFactory } = setup([bolt]);

    const preview = await previewImport(store, repository, idFactory, "4 Lightning Bolt");

    expect(preview.status).toBe("partial");
    expect(preview.issues).toContainEqual(
      expect.objectContaining({ code: "maindeck-below-minimum" }),
    );
  });

  it("skips FR-4 validation when validate: false is passed (SPEC-C task C-7, opponent decks)", async () => {
    const { store, repository, idFactory } = setup([bolt]);

    const preview = await previewImport(store, repository, idFactory, "4 Lightning Bolt", {
      validate: false,
    });

    expect(preview.issues).toEqual([]);
    // Still resolves fine — only validation is skipped, not resolution.
    expect(preview.status).toBe("ready");
    expect(preview.deck?.maindeck).toEqual([{ cardId: bolt.oracleId, quantity: 4 }]);
  });

  it("reports status error and produces no deck when nothing parses", async () => {
    const { store, repository, idFactory } = setup([bolt]);

    const preview = await previewImport(store, repository, idFactory, "");

    expect(preview.status).toBe("error");
    expect(preview.deck).toBeUndefined();
    expect(store.getState().status).toBe("error");
  });

  it("preserves a listed printing hint on the DeckEntry for round-trip fidelity (D-6)", async () => {
    const { store, repository, idFactory } = setup([bolt]);

    const preview = await previewImport(store, repository, idFactory, "4 Lightning Bolt (2XM) 129");

    expect(preview.deck?.maindeck).toEqual([
      {
        cardId: bolt.oracleId,
        quantity: 4,
        listedPrinting: { set: "2xm", collectorNumber: "129" },
      },
    ]);
  });

  it("surfaces a retryable error instead of an unhandled rejection when resolution fails outright (NFR-4.2)", async () => {
    const store = createWorkspaceStore(createIdFactory(countingSource()));
    const idFactory = createIdFactory(countingSource());
    const repository = {
      resolve: () => Promise.reject(new Error("network down")),
      peek: () => undefined,
      suggest: () => Promise.resolve(undefined),
    };

    const preview = await previewImport(store, repository, idFactory, "4 Lightning Bolt");

    expect(preview.status).toBe("error");
    expect(preview.retryable).toBe(true);
    expect(preview.errorMessage).toBeDefined();
    expect(store.getState().status).toBe("error");
  });
});

describe("commitImport", () => {
  it("replaces workspace.deck with the preview's deck", async () => {
    const { store, repository, idFactory } = setup([bolt, swiftspear, mountain]);
    const preview = await previewImport(
      store,
      repository,
      idFactory,
      "4 Lightning Bolt\n4 Monastery Swiftspear\n52 Mountain",
    );

    commitImport(store, preview);

    expect(store.getState().workspace.deck).toEqual(preview.deck);
    expect(store.getState().status).toBe("ready");
  });

  it("reconciles existing matchup plans against the newly committed deck (FR-6.9, story A4)", async () => {
    const { store, repository, idFactory } = setup([bolt, swiftspear]);

    // First import: a deck with 4 Lightning Bolt, then plan boarding 2 out.
    commitImport(store, await previewImport(store, repository, idFactory, "4 Lightning Bolt"));
    const matchupId = store.getState().addMatchup("UR Murktide");
    store
      .getState()
      .editPlan(matchupId, "unified", (plan, ctx) => addOut(plan, ctx, bolt.oracleId, 2));

    // Re-import with only 1 Lightning Bolt — the plan's "out 2" no longer fits.
    const preview = await previewImport(
      store,
      repository,
      idFactory,
      "1 Lightning Bolt\n4 Monastery Swiftspear",
    );
    const { reconciliations } = commitImport(store, preview);

    expect(reconciliations).toEqual([
      {
        matchupId,
        variant: "unified",
        // `from`/`to` are maindeck copies available before/after re-import
        // (the plan requested "out 2"; the old deck had 4 copies to draw from).
        changes: [{ kind: "reduced", side: "out", cardId: bolt.oracleId, from: 4, to: 1 }],
      },
    ]);
    const plan = store.getState().workspace.matchups[0]?.plans.unified;
    expect(plan?.out).toEqual([{ cardId: bolt.oracleId, quantity: 1 }]);
  });

  it("does not report reconciliation changes for an untouched matchup", async () => {
    const { store, repository, idFactory } = setup([bolt, swiftspear]);

    commitImport(store, await previewImport(store, repository, idFactory, "4 Lightning Bolt"));
    const matchupId = store.getState().addMatchup("Untouched");
    store
      .getState()
      .editPlan(matchupId, "unified", (plan, ctx) => addOut(plan, ctx, bolt.oracleId, 1));

    const preview = await previewImport(
      store,
      repository,
      idFactory,
      "4 Lightning Bolt\n4 Monastery Swiftspear",
    );
    const { reconciliations } = commitImport(store, preview);

    expect(reconciliations).toEqual([]);
  });

  it("does nothing when the preview has no deck (status error)", async () => {
    const { store, repository, idFactory } = setup([bolt]);
    const preview = await previewImport(store, repository, idFactory, "");

    const { reconciliations } = commitImport(store, preview);

    expect(reconciliations).toEqual([]);
    expect(store.getState().workspace.deck).toBeUndefined();
  });
});
