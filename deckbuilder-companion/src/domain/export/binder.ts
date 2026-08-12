/**
 * SPEC-E Task E-1 — the binder view model. Both exporters (E-2 Markdown,
 * E-3 PDF) render this, not the raw `Workspace`, which is what makes them
 * trivial and testable without a renderer.
 *
 * `buildBinder` uses `repo.peek()` only — never `resolve()` — which is what
 * makes FR-10.12 (export works offline) a property of the design rather
 * than something to test for and hope.
 */
import { countCards } from "../deck/queries";
import type { PlanContext } from "../plan/actions";
import { matchupStatus } from "../plan/summary";
import { validatePlan } from "../plan/validate";
import type {
  CardId,
  DeckEntry,
  Matchup,
  MatchupId,
  PlanEntry,
  SideboardPlan,
  Workspace,
} from "../model/types";
import type { CardRepository } from "../ports/CardRepository";
import { EXPORT_ATTRIBUTION } from "./attribution";

export interface BinderPlanLine {
  readonly quantity: number;
  readonly name: string;
  readonly note?: string; // FR-6.7
}

export interface BinderPlanVariant {
  readonly label: "Sideboard plan" | "On the play" | "On the draw";
  readonly out: readonly BinderPlanLine[];
  readonly in: readonly BinderPlanLine[];
  readonly outTotal: number;
  readonly inTotal: number;
  readonly balanceNote?: string; // e.g. "Unbalanced: 2 out, 3 in"
}

export interface BinderMatchup {
  readonly name: string;
  readonly priority?: Matchup["priority"];
  readonly gamePlan: string;
  readonly variants: readonly BinderPlanVariant[]; // 1 when unified, 2 when split
  readonly isIncomplete: boolean; // FR-7.6
}

export interface BinderDeckSummary {
  readonly name: string;
  readonly maindeck: readonly BinderPlanLine[];
  readonly maindeckCount: number;
  readonly sideboard: readonly BinderPlanLine[];
  readonly sideboardCount: number;
}

export interface BinderDocument {
  readonly title: string;
  readonly generatedAt: string;
  readonly deck: BinderDeckSummary;
  readonly matchups: readonly BinderMatchup[];
  readonly attribution: string; // FR-10.13, NFR-7.5
}

export interface BinderOptions {
  /** FR-10.10 — undefined/omitted means every matchup. */
  readonly matchupIds?: readonly MatchupId[];
  /** Default `true`. */
  readonly includeNotes?: boolean;
  /** Injectable clock — tests need a deterministic `generatedAt`. */
  readonly now?: () => Date;
}

const EMPTY_PLAN: SideboardPlan = { out: [], in: [] };

/** Cache-only — falls back to the id itself rather than dropping the line (FR-10.12, offline). */
function cardName(cardId: CardId, repo: CardRepository): string {
  return repo.peek(cardId)?.name ?? cardId;
}

function toDeckLines(
  entries: readonly DeckEntry[],
  repo: CardRepository,
): readonly BinderPlanLine[] {
  return entries.map((entry) => ({ quantity: entry.quantity, name: cardName(entry.cardId, repo) }));
}

/** Deterministic across two calls: quantity descending, then name ascending. */
function sortLines(lines: readonly BinderPlanLine[]): readonly BinderPlanLine[] {
  return [...lines].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

function toPlanLines(
  entries: readonly PlanEntry[],
  repo: CardRepository,
  includeNotes: boolean,
): readonly BinderPlanLine[] {
  const lines = entries.map((entry): BinderPlanLine => ({
    quantity: entry.quantity,
    name: cardName(entry.cardId, repo),
    ...(includeNotes && entry.note !== undefined ? { note: entry.note } : {}),
  }));
  return sortLines(lines);
}

function buildVariant(
  label: BinderPlanVariant["label"],
  plan: SideboardPlan | undefined,
  ctx: PlanContext,
  repo: CardRepository,
  includeNotes: boolean,
): BinderPlanVariant {
  const effectivePlan = plan ?? EMPTY_PLAN;
  const validation = validatePlan(effectivePlan, ctx);
  const balanceNote =
    validation.outTotal !== validation.inTotal
      ? `Unbalanced: ${validation.outTotal} out, ${validation.inTotal} in`
      : undefined;

  return {
    label,
    out: toPlanLines(effectivePlan.out, repo, includeNotes),
    in: toPlanLines(effectivePlan.in, repo, includeNotes),
    outTotal: validation.outTotal,
    inTotal: validation.inTotal,
    ...(balanceNote !== undefined ? { balanceNote } : {}),
  };
}

function buildMatchup(
  matchup: Matchup,
  ctx: PlanContext,
  repo: CardRepository,
  includeNotes: boolean,
): BinderMatchup {
  const variants: BinderPlanVariant[] = matchup.splitPlayDraw
    ? [
        buildVariant("On the play", matchup.plans.onPlay, ctx, repo, includeNotes),
        buildVariant("On the draw", matchup.plans.onDraw, ctx, repo, includeNotes),
      ]
    : [buildVariant("Sideboard plan", matchup.plans.unified, ctx, repo, includeNotes)];

  return {
    name: matchup.name,
    ...(matchup.priority !== undefined ? { priority: matchup.priority } : {}),
    gamePlan: matchup.gamePlan,
    variants,
    isIncomplete: matchupStatus(matchup, ctx) !== "valid",
  };
}

export function buildBinder(
  ws: Workspace,
  repo: CardRepository,
  opts: BinderOptions,
): BinderDocument {
  const deck = ws.deck;
  const includeNotes = opts.includeNotes ?? true;
  const now = opts.now ?? (() => new Date());

  const selected =
    opts.matchupIds === undefined
      ? ws.matchups
      : ws.matchups.filter((m) => opts.matchupIds?.includes(m.id) ?? false);

  const deckSummary: BinderDeckSummary =
    deck === undefined
      ? { name: "", maindeck: [], maindeckCount: 0, sideboard: [], sideboardCount: 0 }
      : {
          name: deck.name,
          maindeck: toDeckLines(deck.maindeck, repo),
          maindeckCount: countCards(deck.maindeck),
          sideboard: toDeckLines(deck.sideboard, repo),
          sideboardCount: countCards(deck.sideboard),
        };

  const ctx: PlanContext = { deck: deck ?? { ...EMPTY_DECK } };

  return {
    title: `${deck?.name ?? "Untitled Deck"} — Sideboard Binder`,
    generatedAt: now().toISOString(),
    deck: deckSummary,
    matchups: selected.map((m) => buildMatchup(m, ctx, repo, includeNotes)),
    attribution: EXPORT_ATTRIBUTION,
  };
}

const EMPTY_DECK = {
  id: "",
  name: "",
  format: "unknown",
  maindeck: [],
  sideboard: [],
  importedAt: "",
  sourceText: "",
} as const;
