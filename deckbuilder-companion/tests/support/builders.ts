/**
 * SPEC-001 Task 7 / SPEC-002 Task 1 — domain object builders with sane
 * defaults, so tests state only what they care about. Deferred from
 * SPEC-001 because they need the shapes this spec defines; see
 * SPEC-001 §8 deviation 7.
 */
import { toCardId, toMatchupId } from "@/domain/model/types";
import type { Card, Deck, Matchup, SideboardPlan, Workspace } from "@/domain/model/types";

export const aCard = (overrides: Partial<Card> = {}): Card => ({
  oracleId: toCardId("card-lightning-bolt"),
  name: "Lightning Bolt",
  manaCost: "{R}",
  manaValue: 1,
  typeLine: "Instant",
  oracleText: "Lightning Bolt deals 3 damage to any target.",
  colors: ["R"],
  colorIdentity: ["R"],
  rarity: "common",
  set: "lea",
  collectorNumber: "161",
  layout: "normal",
  cachedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

export const aDeck = (overrides: Partial<Deck> = {}): Deck => ({
  id: "deck-1",
  name: "Test Deck",
  format: "modern",
  maindeck: [{ cardId: toCardId("card-lightning-bolt"), quantity: 4 }],
  sideboard: [{ cardId: toCardId("card-rest-in-peace"), quantity: 2 }],
  importedAt: "2026-01-01T00:00:00.000Z",
  sourceText: "4 Lightning Bolt\n\n2 Rest in Peace",
  ...overrides,
});

export const aMatchup = (overrides: Partial<Matchup> = {}): Matchup => ({
  id: toMatchupId("matchup-1"),
  name: "Test Matchup",
  tags: [],
  gamePlan: "",
  splitPlayDraw: false,
  plans: {},
  ...overrides,
});

export const aPlan = (overrides: Partial<SideboardPlan> = {}): SideboardPlan => ({
  out: [],
  in: [],
  ...overrides,
});

export function aWorkspaceWith(opts: { matchups?: number; deck?: Deck } = {}): Workspace {
  const matchupCount = opts.matchups ?? 0;
  return {
    schemaVersion: 1,
    ...(opts.deck ? { deck: opts.deck } : {}),
    matchups: Array.from({ length: matchupCount }, (_, index) =>
      aMatchup({ id: toMatchupId(`matchup-${index + 1}`), name: `Matchup ${index + 1}` }),
    ),
  };
}
