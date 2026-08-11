/**
 * SPEC-C Task C-2 — matchup validity summary (FR-5.7). Precedence, highest
 * first: `broken` (a reference no longer resolves, FR-6.9) → `unbalanced` →
 * `incomplete` (split is on but only one variant has a plan) → `empty` →
 * `valid`. A broken reference is the more urgent thing to tell the user
 * about, so it outranks an otherwise-unbalanced count.
 */
import type { Matchup, PlanEntry, SideboardPlan } from "../model/types";
import type { PlanContext } from "./actions";

export type MatchupStatus = "empty" | "incomplete" | "unbalanced" | "broken" | "valid";

function isEmptyPlan(plan: SideboardPlan | undefined): boolean {
  return plan === undefined || (plan.out.length === 0 && plan.in.length === 0);
}

function total(entries: readonly PlanEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function isBalanced(plan: SideboardPlan): boolean {
  return total(plan.out) === total(plan.in);
}

function hasBrokenEntry(plan: SideboardPlan | undefined): boolean {
  return plan !== undefined && [...plan.out, ...plan.in].some((entry) => entry.broken === true);
}

function activePlans(matchup: Matchup): readonly SideboardPlan[] {
  const plans = matchup.splitPlayDraw
    ? [matchup.plans.onPlay, matchup.plans.onDraw]
    : [matchup.plans.unified];
  return plans.filter((plan): plan is SideboardPlan => plan !== undefined);
}

export function matchupStatus(matchup: Matchup, ctx: PlanContext): MatchupStatus {
  void ctx; // reserved: `broken` is read from the stored flag reconcilePlan already wrote, not re-derived here.
  const plans = activePlans(matchup);

  if (plans.some(hasBrokenEntry)) return "broken";
  if (plans.some((plan) => !isBalanced(plan))) return "unbalanced";

  if (matchup.splitPlayDraw) {
    const playEmpty = isEmptyPlan(matchup.plans.onPlay);
    const drawEmpty = isEmptyPlan(matchup.plans.onDraw);
    if (playEmpty !== drawEmpty) return "incomplete";
  }

  if (plans.length === 0 || plans.every(isEmptyPlan)) return "empty";

  return "valid";
}
