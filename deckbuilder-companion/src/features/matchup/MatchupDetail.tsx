"use client";

/**
 * SPEC-C Task C-8 — the matchup detail shell: header (name, status,
 * priority), game plan editor slot, an empty sideboard planner slot (SPEC-D
 * fills it in), and the opponent deck panel (task C-7). Built with the
 * planner slot empty so this spec's E2E specs can pass before SPEC-D exists.
 */
import { useState, type KeyboardEvent } from "react";
import { DeckView } from "@/features/deck/DeckView";
import { GamePlanEditor } from "@/features/plan/GamePlanEditor";
import { ImportScreen } from "@/features/import/ImportScreen";
import { SideboardPlanner } from "@/features/plan/SideboardPlanner";
import { matchupStatus, type MatchupStatus } from "@/domain/plan/summary";
import type { Matchup } from "@/domain/model/types";
import { useWorkspaceState, useWorkspaceStoreApi } from "@/state/WorkspaceProvider";

const STATUS_META: Record<MatchupStatus, { icon: string; label: string; className: string }> = {
  valid: { icon: "✓", label: "Valid", className: "text-green-600 dark:text-green-400" },
  unbalanced: { icon: "⚠", label: "Unbalanced", className: "text-amber-600 dark:text-amber-400" },
  incomplete: { icon: "◐", label: "Incomplete", className: "text-accent" },
  empty: { icon: "●", label: "Empty", className: "text-muted-foreground" },
  broken: { icon: "✕", label: "Broken", className: "text-red-600 dark:text-red-400" },
};

const PRIORITY_OPTIONS: ReadonlyArray<{
  value: NonNullable<Matchup["priority"]> | "";
  label: string;
}> = [
  { value: "", label: "No priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function TagList({ matchup }: { matchup: Matchup }) {
  const store = useWorkspaceStoreApi();
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const tag = draft.trim();
    if (tag === "" || matchup.tags.includes(tag)) {
      setDraft("");
      return;
    }
    store.getState().setTags(matchup.id, [...matchup.tags, tag]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    store.getState().setTags(
      matchup.id,
      matchup.tags.filter((t) => t !== tag),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="matchup-tags">
      {matchup.tags.map((tag) => (
        <span
          key={tag}
          data-testid="matchup-tag"
          className="border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            className="text-muted-foreground"
            onClick={() => removeTag(tag)}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        data-testid="matchup-tag-input"
        placeholder="Add tag"
        className="border-border bg-background w-24 rounded-md border px-2 py-0.5 text-xs"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addTag}
      />
    </div>
  );
}

export function MatchupDetail() {
  const store = useWorkspaceStoreApi();
  const deck = useWorkspaceState((s) => s.workspace.deck);
  const matchups = useWorkspaceState((s) => s.workspace.matchups);
  const selectedId = useWorkspaceState((s) => s.selectedMatchupId);
  const [opponentPanelOpen, setOpponentPanelOpen] = useState(false);

  const matchup = matchups.find((m) => m.id === selectedId);

  if (deck === undefined || matchup === undefined) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="matchup-detail-empty">
        Select or add a matchup to plan your sideboard against it.
      </p>
    );
  }

  const status = matchupStatus(matchup, { deck });
  const statusMeta = STATUS_META[status];

  return (
    <div className="space-y-6" data-testid="matchup-detail">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 data-testid="matchup-detail-name" className="text-foreground text-xl font-semibold">
            {matchup.name}
          </h2>
          <span
            data-testid="matchup-detail-status"
            data-status={status}
            className={`inline-flex items-center gap-1 text-sm font-medium ${statusMeta.className}`}
          >
            <span aria-hidden="true">{statusMeta.icon}</span>
            {statusMeta.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Priority</span>
            <select
              data-testid="matchup-priority"
              className="border-border bg-background rounded-md border px-2 py-1"
              value={matchup.priority ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                store
                  .getState()
                  .setPriority(
                    matchup.id,
                    value === "" ? undefined : (value as NonNullable<Matchup["priority"]>),
                  );
              }}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <TagList matchup={matchup} />
        </div>
      </header>

      <GamePlanEditor matchupId={matchup.id} gamePlan={matchup.gamePlan} />

      <SideboardPlanner matchup={matchup} deck={deck} />

      <section className="space-y-2" data-testid="opponent-deck-panel">
        <button
          type="button"
          data-testid="opponent-deck-toggle"
          aria-expanded={opponentPanelOpen}
          className="text-foreground text-sm font-semibold"
          onClick={() => setOpponentPanelOpen((v) => !v)}
        >
          Opponent&apos;s deck {opponentPanelOpen ? "▾" : "▸"}
        </button>

        {opponentPanelOpen ? (
          <div className="space-y-3">
            {matchup.opponentDeck !== undefined ? (
              <>
                <button
                  type="button"
                  data-testid="opponent-deck-remove"
                  className="text-muted-foreground text-xs underline underline-offset-2"
                  onClick={() => store.getState().removeOpponentDeck(matchup.id)}
                >
                  Remove opponent deck
                </button>
                <DeckView deck={matchup.opponentDeck} compact />
              </>
            ) : (
              <ImportScreen variant="opponent" matchupId={matchup.id} />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
