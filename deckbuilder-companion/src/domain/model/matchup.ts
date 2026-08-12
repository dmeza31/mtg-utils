/**
 * SPEC-C Task C-1 — matchup factory and operations (FR-5.1, FR-5.2, FR-5.5).
 * Pure functions: the store (task C-3) delegates to these rather than
 * building matchups or reordering arrays inline, matching CLAUDE.md's rule
 * that a rule appearing in the store belongs in the domain instead.
 */
import type { IdFactory } from "./ids";
import type { Matchup, PlanEntry, PlanVariant, SideboardPlan } from "./types";

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

/**
 * SPEC-D Task D-9 (FR-6.8) — enabling the split seeds *both* variants from
 * the existing unified plan. The naive "two empty plans" implementation
 * silently discards the user's work; this is why the spec calls the
 * behaviour out explicitly rather than leaving it to "toggle a boolean".
 */
export function enableSplitPlayDraw(matchup: Matchup): Matchup {
  const unified = matchup.plans.unified ?? EMPTY_PLAN;
  return {
    ...matchup,
    splitPlayDraw: true,
    plans: { ...matchup.plans, onPlay: copyPlan(unified), onDraw: copyPlan(unified) },
  };
}

export type SplitKeepChoice = "onPlay" | "onDraw";

/** Disabling never discards silently — the caller must say which variant becomes `unified`. */
export function disableSplitPlayDraw(matchup: Matchup, keep: SplitKeepChoice): Matchup {
  const kept = matchup.plans[keep] ?? EMPTY_PLAN;
  return {
    ...matchup,
    splitPlayDraw: false,
    plans: { ...matchup.plans, unified: copyPlan(kept) },
  };
}

/** D-9's "copy from other variant" action — the two plans usually differ by a card or two. */
export function copyPlanVariant(matchup: Matchup, from: PlanVariant, to: PlanVariant): Matchup {
  const source = matchup.plans[from] ?? EMPTY_PLAN;
  return { ...matchup, plans: { ...matchup.plans, [to]: copyPlan(source) } };
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
