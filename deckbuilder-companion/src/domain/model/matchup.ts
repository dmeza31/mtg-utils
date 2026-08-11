/**
 * SPEC-C Task C-1 — matchup factory and operations (FR-5.1, FR-5.2, FR-5.5).
 * Pure functions: the store (task C-3) delegates to these rather than
 * building matchups or reordering arrays inline, matching CLAUDE.md's rule
 * that a rule appearing in the store belongs in the domain instead.
 */
import type { IdFactory } from "./ids";
import type { Matchup, PlanEntry, SideboardPlan } from "./types";

const EMPTY_PLAN: SideboardPlan = { out: [], in: [] };
const PLAN_VARIANTS = ["unified", "onPlay", "onDraw"] as const;

function requireName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new Error("Matchup name is required (FR-5.2)");
  }
  return trimmed;
}

function copyEntries(entries: readonly PlanEntry[]): readonly PlanEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function copyPlan(plan: SideboardPlan): SideboardPlan {
  return { out: copyEntries(plan.out), in: copyEntries(plan.in) };
}

/** A structural copy, not a shallow spread — the copy's plans must never alias the source's. */
function copyPlans(plans: Matchup["plans"]): Matchup["plans"] {
  const copy: Matchup["plans"] = {};
  for (const variant of PLAN_VARIANTS) {
    const plan = plans[variant];
    if (plan !== undefined) {
      copy[variant] = copyPlan(plan);
    }
  }
  return copy;
}

export function createMatchup(ids: IdFactory, name: string): Matchup {
  return {
    id: ids.nextMatchupId(),
    name: requireName(name),
    tags: [],
    gamePlan: "",
    splitPlayDraw: false,
    plans: { unified: { ...EMPTY_PLAN } },
  };
}

export function renameMatchup(matchup: Matchup, name: string): Matchup {
  return { ...matchup, name: requireName(name) };
}

/** Deep-copies plans and notes (story C4) — the source must be unaffected by later edits to the copy. */
export function duplicateMatchup(ids: IdFactory, source: Matchup): Matchup {
  return {
    ...source,
    id: ids.nextMatchupId(),
    name: `${source.name} (copy)`,
    plans: copyPlans(source.plans),
  };
}

/** Bounds-checked array move; returns the original array unchanged for a no-op or out-of-range move. */
export function reorder<T>(items: readonly T[], from: number, to: number): readonly T[] {
  const inRange = (index: number) => index >= 0 && index < items.length;
  if (from === to || !inRange(from) || !inRange(to)) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) {
    return items;
  }
  next.splice(to, 0, moved);
  return next;
}
