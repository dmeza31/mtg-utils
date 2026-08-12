"use client";

/**
 * SPEC-D Task D-3 (FR-7.1, 7.2, 7.3, 7.5). Validation is advisory — this bar
 * reports, it never blocks (FR-7.6). `aria-live="polite"` on the whole
 * region is what makes the totals usable to screen-reader users without
 * polling after every drag/step (NFR-2.6).
 */
import { validatePlan, type PlanValidation } from "@/domain/plan/validate";
import type { PlanContext } from "@/domain/plan/actions";
import type { SideboardPlan } from "@/domain/model/types";

export interface ValidationBarProps {
  readonly plan: SideboardPlan;
  readonly ctx: PlanContext;
}

const MINIMUM_MAINDECK_SIZE = 60;

/** The FR-7.2 wording, asserted literally by D4-plan-validation.spec.ts: "2 out, 3 in — 1 too many". */
function unbalancedMessage(validation: PlanValidation): string {
  const magnitude = Math.abs(validation.delta);
  const direction = validation.delta > 0 ? "too many" : "too few";
  return `${validation.outTotal} out, ${validation.inTotal} in — ${magnitude} ${direction}`;
}

export function ValidationBar({ plan, ctx }: ValidationBarProps) {
  const validation = validatePlan(plan, ctx);
  const balanced = validation.outTotal === validation.inTotal;
  const isEmpty = validation.outTotal === 0 && validation.inTotal === 0;
  const brokenIssues = validation.issues.filter((issue) => issue.code === "broken-reference");
  const underMinimum = validation.postBoardSize < MINIMUM_MAINDECK_SIZE;

  return (
    <div
      data-testid="plan-validation"
      data-status={isEmpty ? "empty" : balanced ? "balanced" : "unbalanced"}
      role="status"
      aria-live="polite"
      className="border-border bg-background sticky top-0 z-10 flex flex-col gap-2 rounded-md border p-3 text-sm shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className={
            isEmpty
              ? "text-muted-foreground"
              : balanced
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
          }
        >
          {isEmpty ? "◐" : balanced ? "✓" : "⚠"}
        </span>

        <span data-testid="plan-out-total" className="font-medium">
          {validation.outTotal} out
        </span>
        <span data-testid="plan-in-total" className="font-medium">
          {validation.inTotal} in
        </span>

        {!balanced ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {unbalancedMessage(validation)}
          </span>
        ) : isEmpty ? (
          <span className="text-muted-foreground text-xs">Incomplete — no plan yet</span>
        ) : null}

        <span
          data-testid="plan-postboard-size"
          data-under-minimum={underMinimum}
          className={underMinimum ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}
        >
          Post-board: {validation.postBoardSize} cards
          {underMinimum ? ` (below ${MINIMUM_MAINDECK_SIZE})` : ""}
        </span>
      </div>

      {brokenIssues.length > 0 ? (
        <ul className="text-red-600 dark:text-red-400" data-testid="plan-broken-warnings">
          {brokenIssues.map((issue) => (
            <li key={`${issue.cardId}-${issue.code}`}>
              <span aria-hidden="true">✕</span> {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
