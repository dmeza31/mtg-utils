/**
 * SPEC-E Task E-1 — the binder view model. `buildBinder` is what makes
 * both exporters (E-2 Markdown, E-3 PDF) trivial and testable without a
 * renderer: every test here is a fact about the *data*, not about how it's
 * eventually laid out on a page.
 */
import { describe, expect, it } from "vitest";
import { FakeCardRepository } from "../../../tests/support/FakeCardRepository";
import { aCard, aDeck, aMatchup } from "../../../tests/support/builders";
import { toCardId, toMatchupId } from "../model/types";
import type { Matchup, Workspace } from "../model/types";
import { EXPORT_ATTRIBUTION } from "./attribution";
import { buildBinder } from "./binder";

const bolt = toCardId("card-lightning-bolt");
const rip = toCardId("card-rest-in-peace");
const force = toCardId("card-force-of-negation");
const ghost = toCardId("card-ghost-quarter");

const catalog = [
  aCard({ oracleId: bolt, name: "Lightning Bolt" }),
  aCard({ oracleId: rip, name: "Rest in Peace" }),
  aCard({ oracleId: force, name: "Force of Negation" }),
];

async function repo(): Promise<FakeCardRepository> {
  const r = new FakeCardRepository(catalog);
  await r.resolve(catalog.map((c) => ({ name: c.name })));
  return r;
}

const deck = aDeck({
  name: "Izzet Murktide",
  maindeck: [{ cardId: bolt, quantity: 4 }],
  sideboard: [{ cardId: rip, quantity: 2 }],
});

function workspaceWith(matchups: readonly Matchup[]): Workspace {
  return { schemaVersion: 1, deck, matchups };
}

describe("buildBinder", () => {
  it("(FR-10.1, FR-10.2) every required element is present", async () => {
    const r = await repo();
    const matchup = aMatchup({
      name: "Amulet Titan",
      priority: "high",
      gamePlan: "Be the aggressor.",
      plans: {
        unified: {
          out: [{ cardId: bolt, quantity: 2, note: "too slow" }],
          in: [{ cardId: rip, quantity: 2 }],
        },
      },
    });

    const doc = buildBinder(workspaceWith([matchup]), r, {});

    expect(doc.deck.name).toBe("Izzet Murktide");
    const [binderMatchup] = doc.matchups;
    expect(binderMatchup?.name).toBe("Amulet Titan");
    expect(binderMatchup?.priority).toBe("high");
    expect(binderMatchup?.gamePlan).toBe("Be the aggressor.");
    const [variant] = binderMatchup?.variants ?? [];
    expect(variant?.out).toEqual([{ quantity: 2, name: "Lightning Bolt", note: "too slow" }]);
    expect(variant?.in).toEqual([{ quantity: 2, name: "Rest in Peace" }]);
    expect(variant?.outTotal).toBe(2);
    expect(variant?.inTotal).toBe(2);
  });

  it("(FR-10.3) a split matchup produces two labelled variants", async () => {
    const matchup = aMatchup({
      name: "Burn",
      splitPlayDraw: true,
      plans: {
        onPlay: { out: [{ cardId: bolt, quantity: 1 }], in: [] },
        onDraw: { out: [], in: [{ cardId: rip, quantity: 1 }] },
      },
    });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), {});

    const variants = doc.matchups[0]?.variants ?? [];
    expect(variants).toHaveLength(2);
    expect(variants[0]?.label).toBe("On the play");
    expect(variants[1]?.label).toBe("On the draw");
  });

  it("a unified (non-split) matchup produces one variant labelled 'Sideboard plan'", async () => {
    const matchup = aMatchup({
      plans: { unified: { out: [{ cardId: bolt, quantity: 1 }], in: [] } },
    });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), {});

    const variants = doc.matchups[0]?.variants ?? [];
    expect(variants).toHaveLength(1);
    expect(variants[0]?.label).toBe("Sideboard plan");
  });

  it("(FR-7.6) an unbalanced plan sets balanceNote and isIncomplete — it still exports", async () => {
    const matchup = aMatchup({
      plans: {
        unified: {
          out: [{ cardId: bolt, quantity: 2 }],
          in: [{ cardId: rip, quantity: 1 }],
        },
      },
    });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), {});

    const binderMatchup = doc.matchups[0];
    expect(binderMatchup?.isIncomplete).toBe(true);
    expect(binderMatchup?.variants[0]?.balanceNote).toBe("Unbalanced: 2 out, 1 in");
  });

  it("(FR-6.7) per-card notes flow through", async () => {
    const matchup = aMatchup({
      plans: {
        unified: { out: [{ cardId: bolt, quantity: 1, note: "vs removal" }], in: [] },
      },
    });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), {});

    expect(doc.matchups[0]?.variants[0]?.out[0]?.note).toBe("vs removal");
  });

  it("notes can be suppressed via opts.includeNotes = false", async () => {
    const matchup = aMatchup({
      plans: {
        unified: { out: [{ cardId: bolt, quantity: 1, note: "vs removal" }], in: [] },
      },
    });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), { includeNotes: false });

    expect(doc.matchups[0]?.variants[0]?.out[0]?.note).toBeUndefined();
  });

  it("(FR-10.10) opts.matchupIds filters the selection", async () => {
    const a = aMatchup({ id: toMatchupId("m-a"), name: "A" });
    const b = aMatchup({ id: toMatchupId("m-b"), name: "B" });
    const c = aMatchup({ id: toMatchupId("m-c"), name: "C" });

    const doc = buildBinder(workspaceWith([a, b, c]), await repo(), {
      matchupIds: [toMatchupId("m-a"), toMatchupId("m-c")],
    });

    expect(doc.matchups.map((m) => m.name)).toEqual(["A", "C"]);
  });

  it("matchups appear in the workspace's (sidebar) order by default", async () => {
    const b = aMatchup({ id: toMatchupId("m-b"), name: "B" });
    const a = aMatchup({ id: toMatchupId("m-a"), name: "A" });

    const doc = buildBinder(workspaceWith([b, a]), await repo(), {});

    expect(doc.matchups.map((m) => m.name)).toEqual(["B", "A"]);
  });

  it("(NFR-7.5) attribution is always present and matches the canonical constant", async () => {
    const doc = buildBinder(workspaceWith([]), await repo(), {});
    expect(doc.attribution).toBe(EXPORT_ATTRIBUTION);
  });

  it("an unresolvable card falls back rather than producing a blank line", async () => {
    const matchup = aMatchup({
      plans: { unified: { out: [{ cardId: ghost, quantity: 1 }], in: [] } },
    });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), {});

    const line = doc.matchups[0]?.variants[0]?.out[0];
    expect(line?.name).toBeTruthy();
    expect(line?.name).not.toBe("");
  });

  it("an unresolvable deck entry falls back rather than being dropped", async () => {
    const brokenDeck = aDeck({ maindeck: [{ cardId: ghost, quantity: 1 }], sideboard: [] });
    const doc = buildBinder({ schemaVersion: 1, deck: brokenDeck, matchups: [] }, await repo(), {});

    expect(doc.deck.maindeck).toHaveLength(1);
    expect(doc.deck.maindeck[0]?.name).toBeTruthy();
  });

  it("plan lines sort by quantity descending, then by name", async () => {
    const matchup = aMatchup({
      plans: {
        unified: {
          out: [
            { cardId: bolt, quantity: 1 },
            { cardId: force, quantity: 3 },
            { cardId: rip, quantity: 1 },
          ],
          in: [],
        },
      },
    });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), {});

    expect(doc.matchups[0]?.variants[0]?.out.map((l) => l.name)).toEqual([
      "Force of Negation",
      "Lightning Bolt",
      "Rest in Peace",
    ]);
  });

  it("a matchup with no plan at all still renders a section, not vanishing", async () => {
    const matchup = aMatchup({ name: "No Plan Yet", plans: {} });

    const doc = buildBinder(workspaceWith([matchup]), await repo(), {});

    expect(doc.matchups).toHaveLength(1);
    expect(doc.matchups[0]?.name).toBe("No Plan Yet");
    expect(doc.matchups[0]?.variants[0]?.out).toEqual([]);
  });

  it("performs no I/O — a repository whose resolve() throws is never called", async () => {
    class NoNetworkRepo extends FakeCardRepository {
      override resolve(): Promise<never> {
        throw new Error("buildBinder must never call resolve()");
      }
    }
    const r = new NoNetworkRepo(catalog);

    const matchup = aMatchup({
      plans: { unified: { out: [{ cardId: bolt, quantity: 1 }], in: [] } },
    });

    expect(() => buildBinder(workspaceWith([matchup]), r, {})).not.toThrow();
  });

  it("returns an empty binder for a workspace with no deck", () => {
    const doc = buildBinder({ schemaVersion: 1, matchups: [] }, new FakeCardRepository(), {});
    expect(doc.deck.maindeck).toEqual([]);
    expect(doc.deck.sideboard).toEqual([]);
  });
});
