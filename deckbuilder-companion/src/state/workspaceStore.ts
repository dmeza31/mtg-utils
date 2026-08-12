/**
 * SPEC-002 Task 9 / SPEC-C Task C-3. Thin: it holds state and delegates
 * every mutation to a domain function. If a rule ever appears here, it
 * belongs in `src/domain/plan/` or `src/domain/model/` instead — matchup
 * construction, duplication, and reordering live in
 * `src/domain/model/matchup.ts` (SPEC-C task C-1).
 *
 * Wrapped with zundo (FR-8.9) partialized to `workspace` only, so undo/redo
 * never touches `status` or `selectedMatchupId` — restoring an old
 * `workspace` into a stale "resolving"/"error" status or a since-deleted
 * selection would be a bug. `removeMatchup` needing to be undoable (FR-5.6)
 * falls out of this for free: it's just another `workspace` mutation zundo
 * already tracks, not a bespoke trash bin.
 */
import { temporal } from "zundo";
import { createStore } from "zustand/vanilla";
import {
  createMatchup,
  duplicateMatchup,
  renameMatchup as renameMatchupDomain,
  reorder,
} from "../domain/model/matchup";
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

/**
 * SPEC-A Task A-9 extends this with `parsing`/`resolving`/`partial` — the
 * granular progress states `importDeck` (`src/state/importDeck.ts`) drives
 * so the UI can show real loading state instead of a spinner of unknown
 * duration. `partial` means the deck imported but has unresolved names or
 * validation warnings (FR-4.4 — advisory, never blocking).
 */
export type WorkspaceStatus = "empty" | "parsing" | "resolving" | "ready" | "partial" | "error";

export interface WorkspaceState {
  readonly workspace: Workspace;
  readonly status: WorkspaceStatus;
  /** SPEC-C task C-3 — which matchup the sidebar/detail view is showing. Not undo-tracked (see module doc). */
  readonly selectedMatchupId?: MatchupId | undefined;
  setDeck(deck: Deck): void;
  addMatchup(name: string): MatchupId;
  selectMatchup(id: MatchupId): void;
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
  setPriority(id: MatchupId, priority: Matchup["priority"]): void;
  setTags(id: MatchupId, tags: readonly string[]): void;
  /** SPEC-C task C-7 — reuses the SPEC-A import path; commits to the matchup, not `workspace.deck`. */
  setOpponentDeck(id: MatchupId, deck: Deck): void;
  removeOpponentDeck(id: MatchupId): void;
}

const EMPTY_PLAN: SideboardPlan = { out: [], in: [] };

/** Drops an optional key entirely (vs. setting it to `undefined`, disallowed under `exactOptionalPropertyTypes`). */
function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/** After removing the matchup at `removedIndex`, which id (if any) is the "sensible neighbour" to select. */
function neighbourAfterRemoval(
  matchupsAfterRemoval: readonly Matchup[],
  removedIndex: number,
): MatchupId | undefined {
  if (matchupsAfterRemoval.length === 0) return undefined;
  const neighbourIndex = Math.min(removedIndex, matchupsAfterRemoval.length - 1);
  return matchupsAfterRemoval[neighbourIndex]?.id;
}

export function createWorkspaceStore(idFactory: IdFactory) {
  return createStore<WorkspaceState>()(
    temporal(
      (set, get) => ({
        workspace: { schemaVersion: 1, matchups: [] },
        status: "empty",
        selectedMatchupId: undefined,

        setDeck: (deck) => {
          set((state) => ({ workspace: { ...state.workspace, deck }, status: "ready" }));
        },

        addMatchup: (name) => {
          const matchup = createMatchup(idFactory, name);
          set((state) => ({
            workspace: { ...state.workspace, matchups: [...state.workspace.matchups, matchup] },
            selectedMatchupId: matchup.id,
          }));
          return matchup.id;
        },

        selectMatchup: (id) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set({ selectedMatchupId: id });
        },

        renameMatchup: (id, name) => {
          const matchup = get().workspace.matchups.find((m) => m.id === id);
          if (matchup === undefined) {
            return;
          }
          const renamed = renameMatchupDomain(matchup, name);
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) => (m.id === id ? renamed : m)),
            },
          }));
        },

        duplicateMatchup: (id) => {
          const source = get().workspace.matchups.find((m) => m.id === id);
          if (source === undefined) {
            return id;
          }

          const copy = duplicateMatchup(idFactory, source);
          set((state) => {
            const index = state.workspace.matchups.findIndex((m) => m.id === id);
            const matchups = [...state.workspace.matchups];
            matchups.splice(index + 1, 0, copy);
            return { workspace: { ...state.workspace, matchups } };
          });

          return copy.id;
        },

        removeMatchup: (id) => {
          const { matchups } = get().workspace;
          const index = matchups.findIndex((m) => m.id === id);
          if (index === -1) {
            return;
          }

          const wasSelected = get().selectedMatchupId === id;
          set((state) => {
            const nextMatchups = state.workspace.matchups.filter((m) => m.id !== id);
            return {
              workspace: { ...state.workspace, matchups: nextMatchups },
              ...(wasSelected
                ? { selectedMatchupId: neighbourAfterRemoval(nextMatchups, index) }
                : {}),
            };
          });
        },

        reorderMatchups: (from, to) => {
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: reorder(state.workspace.matchups, from, to),
            },
          }));
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

        setPriority: (id, priority) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) => {
                if (m.id !== id) return m;
                if (priority === undefined) {
                  return omit(m, "priority");
                }
                return { ...m, priority };
              }),
            },
          }));
        },

        setTags: (id, tags) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) => (m.id === id ? { ...m, tags } : m)),
            },
          }));
        },

        setOpponentDeck: (id, deck) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) =>
                m.id === id ? { ...m, opponentDeck: deck } : m,
              ),
            },
          }));
        },

        removeOpponentDeck: (id) => {
          if (!get().workspace.matchups.some((m) => m.id === id)) {
            return;
          }
          set((state) => ({
            workspace: {
              ...state.workspace,
              matchups: state.workspace.matchups.map((m) =>
                m.id === id ? omit(m, "opponentDeck") : m,
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
