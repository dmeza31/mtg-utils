/**
 * SPEC-002 Task 5 (FR-7). Validation is advisory (requirements FR-4, §3):
 * it reports, it never blocks (FR-7.6) — `validatePlan` always returns a
 * result, even when every issue is severity `error`.
 */
import { copiesOf, countCards, totalCopiesIn75 } from "../deck/queries";
import type { CardId, PlanEntry, SideboardPlan, Zone } from "../model/types";
import type { PlanContext } from "./actions";

export type PlanIssueCode =
  | "unbalanced" // FR-7.2
  | "under-minimum-deck" // FR-7.3
  | "exceeds-maindeck" // FR-6.3 — defence in depth
  | "exceeds-sideboard" // FR-6.4
  | "broken-reference" // FR-6.9
  | "empty"; // plan has no entries at all

export interface PlanIssue {
  readonly code: PlanIssueCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly cardId?: CardId;
}

export interface PlanValidation {
  readonly outTotal: number;
  readonly inTotal: number;
  readonly delta: number;
  readonly postBoardSize: number;
  readonly issues: readonly PlanIssue[];
  readonly isValid: boolean;
}

const MINIMUM_MAINDECK_SIZE = 60;

function sumQuantity(entries: readonly PlanEntry[]): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

function sideExceedsIssues(
  entries: readonly PlanEntry[],
  ctx: PlanContext,
  zone: Zone,
  exceedsCode: "exceeds-maindeck" | "exceeds-sideboard",
  label: "OUT" | "IN",
): PlanIssue[] {
  const issues: PlanIssue[] = [];

  for (const entry of entries) {
    if (totalCopiesIn75(ctx.deck, entry.cardId) === 0) {
      issues.push({
        code: "broken-reference",
        severity: "error",
        message: `${entry.cardId} is no longer in the deck.`,
        cardId: entry.cardId,
      });
      continue;
    }

    const max = copiesOf(ctx.deck, entry.cardId, zone);
    if (entry.quantity > max) {
      issues.push({
        code: exceedsCode,
        severity: "error",
        message: `${entry.cardId}: ${label} quantity ${entry.quantity} exceeds ${max} copies available.`,
        cardId: entry.cardId,
      });
    }
  }

  return issues;
}

export function validatePlan(plan: SideboardPlan, ctx: PlanContext): PlanValidation {
  const outTotal = sumQuantity(plan.out);
  const inTotal = sumQuantity(plan.in);
  const delta = inTotal - outTotal;
  const postBoardSize = countCards(ctx.deck.maindeck) - outTotal + inTotal;

  const issues: PlanIssue[] = [];

  if (plan.out.length === 0 && plan.in.length === 0) {
    issues.push({
      code: "empty",
      severity: "error",
      message: "No sideboard plan has been made for this matchup.",
    });
  }

  if (outTotal !== inTotal) {
    const magnitude = Math.abs(delta);
    const direction = delta > 0 ? "too many" : "too few";
    issues.push({
      code: "unbalanced",
      severity: "error",
      message: `${outTotal} out, ${inTotal} in — ${magnitude} ${direction}`,
    });
  }

  if (postBoardSize < MINIMUM_MAINDECK_SIZE) {
    issues.push({
      code: "under-minimum-deck",
      severity: "error",
      message: `Post-board maindeck would have ${postBoardSize} cards — below the ${MINIMUM_MAINDECK_SIZE}-card minimum.`,
    });
  }

  issues.push(...sideExceedsIssues(plan.out, ctx, "maindeck", "exceeds-maindeck", "OUT"));
  issues.push(...sideExceedsIssues(plan.in, ctx, "sideboard", "exceeds-sideboard", "IN"));

  return {
    outTotal,
    inTotal,
    delta,
    postBoardSize,
    issues,
    isValid: issues.every((issue) => issue.severity !== "error"),
  };
}
