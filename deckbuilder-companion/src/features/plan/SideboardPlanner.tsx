"use client";

/**
 * SPEC-D Task D-2 — the planner shell. Owns UI-only state (interaction
 * mode, which variant tab is showing) and nothing about the plan itself
 * (§2's architectural rule): `DragPlanner` and `ListPlanner` both read
 * `matchup.plans[variant]` from the store and call the same `actions.ts`
 * functions, so FR-9.6 (mode-switch preserves the plan exactly) holds by
 * construction — see Task D-7.
 */
import { useEffect, useState } from "react";
import { DragPlanner } from "@/features/plan/drag/DragPlanner";
import { ListPlanner } from "@/features/plan/list/ListPlanner";
import { ValidationBar } from "@/features/plan/ValidationBar";
import { PostBoardPreview } from "@/features/plan/PostBoardPreview";
import type { PlanContext } from "@/domain/plan/actions";
import type { Deck, Matchup, PlanVariant, SideboardPlan } from "@/domain/model/types";
import { useUndoRedo, useWorkspaceStoreApi } from "@/state/WorkspaceProvider";

export interface SideboardPlannerProps {
  readonly matchup: Matchup;
  readonly deck: Deck;
}

type PlannerMode = "drag" | "list";

const MODE_STORAGE_KEY = "deckbuilder-companion:planner-mode";
const TABLET_QUERY = "(min-width: 768px)";
const EMPTY_PLAN: SideboardPlan = { out: [], in: [] };

function initialMode(): PlannerMode {
  if (typeof window === "undefined") return "drag";
  const stored = window.sessionStorage.getItem(MODE_STORAGE_KEY);
  if (stored === "drag" || stored === "list") return stored;
  return window.matchMedia(TABLET_QUERY).matches ? "drag" : "list";
}

function UndoRedoToolbar() {
  const { canUndo, canRedo, undo, redo } = useUndoRedo();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        data-testid="plan-undo-button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
        className="border-border rounded-md border px-2 py-1 text-xs disabled:opacity-30"
      >
        ↶ Undo
      </button>
      <button
        type="button"
        data-testid="plan-redo-button"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
        className="border-border rounded-md border px-2 py-1 text-xs disabled:opacity-30"
      >
        ↷ Redo
      </button>
    </div>
  );
}

function SplitPlayDrawControl({ matchup }: { matchup: Matchup }) {
  const store = useWorkspaceStoreApi();
  const [choosing, setChoosing] = useState(false);

  const onToggle = (checked: boolean) => {
    if (checked) {
      store.getState().enableSplitPlayDraw(matchup.id);
    } else {
      setChoosing(true);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="split-play-draw-toggle"
          checked={matchup.splitPlayDraw}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className="text-muted-foreground">Split play/draw plans</span>
      </label>

      {choosing ? (
        <div
          data-testid="split-play-draw-keep-prompt"
          role="dialog"
          aria-label="Which plan should become the unified plan?"
          className="border-border bg-muted/40 flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs"
        >
          <span>Keep which plan?</span>
          <button
            type="button"
            data-testid="split-keep-onplay"
            className="border-border rounded border px-2 py-1"
            onClick={() => {
              store.getState().disableSplitPlayDraw(matchup.id, "onPlay");
              setChoosing(false);
            }}
          >
            On the play
          </button>
          <button
            type="button"
            data-testid="split-keep-ondraw"
            className="border-border rounded border px-2 py-1"
            onClick={() => {
              store.getState().disableSplitPlayDraw(matchup.id, "onDraw");
              setChoosing(false);
            }}
          >
            On the draw
          </button>
          <button
            type="button"
            data-testid="split-keep-cancel"
            className="text-muted-foreground px-2 py-1"
            onClick={() => setChoosing(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

function VariantTabs({
  matchup,
  variant,
  onSelect,
}: {
  matchup: Matchup;
  variant: PlanVariant;
  onSelect: (variant: PlanVariant) => void;
}) {
  const store = useWorkspaceStoreApi();
  const other: PlanVariant = variant === "onPlay" ? "onDraw" : "onPlay";

  return (
    <div className="flex items-center gap-2" data-testid="plan-variant-tabs">
      <button
        type="button"
        data-testid="plan-variant-onplay"
        aria-pressed={variant === "onPlay"}
        onClick={() => onSelect("onPlay")}
        className={`rounded-md border px-2 py-1 text-xs ${variant === "onPlay" ? "border-accent text-accent" : "border-border"}`}
      >
        On the play
      </button>
      <button
        type="button"
        data-testid="plan-variant-ondraw"
        aria-pressed={variant === "onDraw"}
        onClick={() => onSelect("onDraw")}
        className={`rounded-md border px-2 py-1 text-xs ${variant === "onDraw" ? "border-accent text-accent" : "border-border"}`}
      >
        On the draw
      </button>
      <button
        type="button"
        data-testid="plan-copy-variant"
        className="text-muted-foreground text-xs underline underline-offset-2"
        onClick={() => store.getState().copyPlanVariant(matchup.id, other, variant)}
      >
        Copy from {other === "onPlay" ? "on the play" : "on the draw"}
      </button>
    </div>
  );
}

export function SideboardPlanner({ matchup, deck }: SideboardPlannerProps) {
  const [mode, setMode] = useState<PlannerMode>(initialMode);
  const [selectedVariant, setSelectedVariant] = useState<PlanVariant>(
    matchup.splitPlayDraw ? "onPlay" : "unified",
  );

  // Split toggled on/off (here or via undo) — a pure derivation rather than
  // an effect: the selected tab only applies while split is on, and "unified"
  // is the only valid variant while it's off.
  const variant: PlanVariant = matchup.splitPlayDraw
    ? selectedVariant === "unified"
      ? "onPlay"
      : selectedVariant
    : "unified";

  const setModePersisted = (next: PlannerMode) => {
    setMode(next);
    window.sessionStorage.setItem(MODE_STORAGE_KEY, next);
  };

  const plan = matchup.plans[variant] ?? EMPTY_PLAN;
  const ctx: PlanContext = { deck };

  return (
    <div data-testid="sideboard-planner" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            data-testid="planner-mode-toggle"
            className="border-border inline-flex overflow-hidden rounded-md border text-xs"
          >
            <button
              type="button"
              aria-pressed={mode === "drag"}
              onClick={() => setModePersisted("drag")}
              className={`px-2 py-1 ${mode === "drag" ? "bg-accent text-background" : ""}`}
            >
              Drag
            </button>
            <button
              type="button"
              aria-pressed={mode === "list"}
              onClick={() => setModePersisted("list")}
              className={`px-2 py-1 ${mode === "list" ? "bg-accent text-background" : ""}`}
            >
              List
            </button>
          </div>
          <UndoRedoToolbar />
        </div>

        <div className="flex items-center gap-3">
          <SplitPlayDrawControl matchup={matchup} />
          <PostBoardPreview deck={deck} plan={plan} />
        </div>
      </div>

      {matchup.splitPlayDraw ? (
        <VariantTabs matchup={matchup} variant={variant} onSelect={setSelectedVariant} />
      ) : null}

      <ValidationBar plan={plan} ctx={ctx} />

      {mode === "drag" ? (
        <DragPlanner matchupId={matchup.id} variant={variant} deck={deck} plan={plan} />
      ) : (
        <ListPlanner matchupId={matchup.id} variant={variant} deck={deck} plan={plan} />
      )}
    </div>
  );
}
