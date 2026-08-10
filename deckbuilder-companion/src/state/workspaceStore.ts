/**
 * SPEC-002 Task 9. Thin: it holds state and delegates every mutation to a
 * domain function. If a rule ever appears here, it belongs in
 * `src/domain/plan/` instead.
 *
 * Wrapped with zundo (FR-8.9) partialized to `workspace` only, so undo/redo
 * never touches `status` — restoring an old `workspace` into a stale
 * "importing" or "error" status would be a bug.
 */
import { temporal } from "zundo";
import { createStore } from "zustand/vanilla";
import type { IdFactory } from "../domain/model/ids";
import type {
  Deck,
  Matchup,
  MatchupId,
  PlanVariant,
  SideboardPlan,
  Workspace,
} from "../domain/model/types";
import type { PlanContext } from "../domain/plan/actions";

export type WorkspaceStatus = "empty" | "importing" | "ready" | "error";

export interface WorkspaceState {
  readonly workspace: Workspace;
  readonly status: WorkspaceStatus;
  setDeck(deck: Deck): void;
  addMatchup(name: string): MatchupId;
  renameMatchup(id: MatchupId, name: string): void;
  duplicateMatchup(id: MatchupId): MatchupId;
  removeMatchup(id: MatchupId): void;
  reorderMatchups(from: number, to: number): void;
  editPlan(
    id: MatchupId,
    variant: PlanVariant,
    fn: (plan: SideboardPlan, ctx: PlanContext) => SideboardPlan,
  ): void;
  setSplitPlayDraw(id: MatchupId, split: boolean): void;
  setGamePlan(id: MatchupId, markdown: string): void;
}

const EMPTY_PLAN: SideboardPlan = { out: [], in: [] };
const PLAN_VARIANTS: readonly PlanVariant[] = ["unified", "onPlay", "onDraw"];

function newMatchup(id: MatchupId, name: string): Matchup {
  return { id, name, tags: [], gamePlan: "", splitPlayDraw: false, plans: {} };
}

function deepCopyPlan(plan: SideboardPlan): SideboardPlan {
  return {
    out: plan.out.map((entry) => ({ ...entry })),
    in: plan.in.map((entry) => ({ ...entry })),
  };
}

/**
 * A structural copy, not a shallow spread — `duplicateMatchup` must not
 * leave the copy's plan aliased to the original's (SPEC-002 Task 9).
 */
function deepCopyPlans(plans: Matchup["plans"]): Matchup["plans"] {
  const copy: Matchup["plans"] = {};
  for (const variant of PLAN_VARIANTS) {
    const plan = plans[variant];
    if (plan !== undefined) {
      copy[variant] = deepCopyPlan(plan);
    }
  }
  return copy;
}

export function createWorkspaceStore(idFactory: IdFactory) {
  return createStore<WorkspaceState>()(
    temporal(
      (set, get) => ({
        workspace: { schemaVersion: 1, matchups: [] },
        status: "empty",

        setDeck: (deck) => {
          set((state) => ({ workspace: { ...state.workspace, deck }, status: "ready" }));
        },

        addMatchup: (name) => {
          const id = idFactory.nextMatchupId();
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: [...state.workspace.matchups, newMatchup(id, name)],
            },
          }));
          return id;
        },

        renameMatchup: (id, name) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) => (m.id === id ? { ...m, name } : m)),
            },
          }));
        },

        duplicateMatchup: (id) => {
          const source = get().workspace.matchups.find((m) => m.id === id);
          if (source === undefined) {
            return id;
          }

          const newId = idFactory.nextMatchupId();
          const copy: Matchup = {
            ...source,
            id: newId,
            name: `${source.name} (copy)`,
            plans: deepCopyPlans(source.plans),
          };

          set((state) => {
            const index = state.workspace.matchups.findIndex((m) => m.id === id);
            const matchups = [...state.workspace.matchups];
            matchups.splice(index + 1, 0, copy);
            return { workspace: { ...state.workspace, matchups } };
          });

          return newId;
        },

        removeMatchup: (id) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.filter((m) => m.id !== id),
            },
          }));
        },

        reorderMatchups: (from, to) => {
          const { matchups } = get().workspace;
          const inRange = (index: number) => index >= 0 && index < matchups.length;
          if (from === to || !inRange(from) || !inRange(to)) {
            return;
          }
          set((state) => {
            const next = [...state.workspace.matchups];
            const [moved] = next.splice(from, 1);
            if (moved === undefined) {
              return state;
            }
            next.splice(to, 0, moved);
            return { workspace: { ...state.workspace, matchups: next } };
          });
        },

        editPlan: (id, variant, fn) => {
          const state = get();
          const { deck } = state.workspace;
          const matchup = state.workspace.matchups.find((m) => m.id === id);
          if (deck === undefined || matchup === undefined) {
            return;
          }

          const currentPlan = matchup.plans[variant] ?? EMPTY_PLAN;
          const ctx: PlanContext = { deck };
          const nextPlan = fn(currentPlan, ctx);

          set((s) => ({
            workspace: {
              ...s.workspace,
              matchups: s.workspace.matchups.map((m) =>
                m.id === id ? { ...m, plans: { ...m.plans, [variant]: nextPlan } } : m,
              ),
            },
          }));
        },

        setSplitPlayDraw: (id, split) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) =>
                m.id === id ? { ...m, splitPlayDraw: split } : m,
              ),
            },
          }));
        },

        setGamePlan: (id, markdown) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) =>
                m.id === id ? { ...m, gamePlan: markdown } : m,
              ),
            },
          }));
        },
      }),
      {
        partialize: (state) => ({ workspace: state.workspace }),
      },
    ),
  );
}
