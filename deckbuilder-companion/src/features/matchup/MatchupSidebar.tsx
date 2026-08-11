"use client";

/**
 * SPEC-C Task C-4 (stories C1, C3) — the matchup list: name, an at-a-glance
 * validity indicator (FR-5.7), add/rename/duplicate/delete, and reorder via
 * drag handle or keyboard (NFR-2.2 — a reorder that requires a mouse fails
 * accessibility). Collapses to a `<select>` below the tablet breakpoint.
 */
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { matchupStatus, type MatchupStatus } from "@/domain/plan/summary";
import type { Matchup, MatchupId } from "@/domain/model/types";
import { useWorkspaceState, useWorkspaceStoreApi } from "@/state/WorkspaceProvider";
import { UndoToast } from "./UndoToast";

const STATUS_META: Record<MatchupStatus, { icon: string; label: string; className: string }> = {
  valid: { icon: "✓", label: "Valid", className: "text-green-600 dark:text-green-400" },
  unbalanced: { icon: "⚠", label: "Unbalanced", className: "text-amber-600 dark:text-amber-400" },
  incomplete: { icon: "◐", label: "Incomplete", className: "text-accent" },
  empty: { icon: "●", label: "Empty", className: "text-muted-foreground" },
  broken: { icon: "✕", label: "Broken", className: "text-red-600 dark:text-red-400" },
};

function StatusBadge({ status }: { status: MatchupStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      data-testid="matchup-status"
      data-status={status}
      className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

interface PendingDelete {
  readonly id: MatchupId;
  readonly name: string;
  readonly index: number;
}

export function MatchupSidebar() {
  const store = useWorkspaceStoreApi();
  const deck = useWorkspaceState((s) => s.workspace.deck);
  const matchups = useWorkspaceState((s) => s.workspace.matchups);
  const selectedId = useWorkspaceState((s) => s.selectedMatchupId);

  const [adding, setAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | undefined>(undefined);
  const [renamingId, setRenamingId] = useState<MatchupId | undefined>(undefined);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | undefined>(undefined);
  const [undoMessage, setUndoMessage] = useState<string | undefined>(undefined);
  const dragIndex = useRef<number | undefined>(undefined);

  const addInputRef = useRef<HTMLInputElement>(null);

  const submitAdd = useCallback(() => {
    try {
      store.getState().addMatchup(addValue);
      setAddValue("");
      setAdding(false);
      setAddError(undefined);
    } catch {
      setAddError("A matchup name is required.");
    }
  }, [store, addValue]);

  const submitRename = useCallback(
    (id: MatchupId) => {
      try {
        store.getState().renameMatchup(id, renameValue);
        setRenamingId(undefined);
      } catch {
        // Leave the input open so the user can correct it (FR-5.2).
      }
    },
    [store, renameValue],
  );

  const requestDelete = useCallback((matchup: Matchup, index: number) => {
    setPendingDelete({ id: matchup.id, name: matchup.name, index });
  }, []);

  const confirmDelete = useCallback(() => {
    if (pendingDelete === undefined) return;
    store.getState().removeMatchup(pendingDelete.id);
    setUndoMessage(`Deleted "${pendingDelete.name}"`);
    setPendingDelete(undefined);
  }, [store, pendingDelete]);

  const undoDelete = useCallback(() => {
    store.temporal.getState().undo();
    setUndoMessage(undefined);
  }, [store]);

  const moveByKeyboard = useCallback(
    (index: number, direction: -1 | 1) => {
      store.getState().reorderMatchups(index, index + direction);
    },
    [store],
  );

  const onItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLLIElement>, index: number) => {
      if (!event.altKey) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveByKeyboard(index, -1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveByKeyboard(index, 1);
      }
    },
    [moveByKeyboard],
  );

  if (deck === undefined) return null;

  return (
    <nav aria-label="Matchups" data-testid="matchup-sidebar" className="space-y-3">
      {/* Mobile / below-tablet: a select stands in for the full list. */}
      <label className="block text-sm md:hidden">
        <span className="text-muted-foreground">Matchup</span>
        <select
          data-testid="matchup-mobile-select"
          className="border-border bg-background mt-1 w-full rounded-md border px-2 py-1"
          value={selectedId ?? ""}
          onChange={(event) => store.getState().selectMatchup(event.target.value as MatchupId)}
        >
          {matchups.length === 0 ? <option value="">No matchups yet</option> : null}
          {matchups.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <ul data-testid="matchup-list" className="hidden space-y-1 md:block">
        {matchups.map((matchup, index) => {
          const status = matchupStatus(matchup, { deck });
          const isSelected = matchup.id === selectedId;
          const isRenaming = renamingId === matchup.id;

          return (
            <li
              key={matchup.id}
              data-testid="matchup-item"
              data-matchup-name={matchup.name}
              data-selected={isSelected}
              tabIndex={0}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex.current !== undefined) {
                  store.getState().reorderMatchups(dragIndex.current, index);
                }
                dragIndex.current = undefined;
              }}
              onKeyDown={(event) => onItemKeyDown(event, index)}
              className={`border-border rounded-md border p-2 ${isSelected ? "bg-muted" : ""}`}
            >
              {isRenaming ? (
                <input
                  autoFocus
                  data-testid="matchup-rename-input"
                  className="border-border bg-background w-full rounded border px-1 text-sm"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitRename(matchup.id);
                    if (event.key === "Escape") setRenamingId(undefined);
                  }}
                  onBlur={() => submitRename(matchup.id)}
                />
              ) : (
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => store.getState().selectMatchup(matchup.id)}
                >
                  <span className="text-foreground text-sm font-medium">{matchup.name}</span>
                  <div className="mt-0.5">
                    <StatusBadge status={status} />
                  </div>
                </button>
              )}

              <div className="mt-1 flex gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className="text-muted-foreground cursor-grab select-none"
                  title="Drag to reorder, or focus this item and press Alt+Up/Alt+Down"
                >
                  ⠿
                </span>
                <button
                  type="button"
                  data-testid="matchup-rename-button"
                  className="text-muted-foreground underline underline-offset-2"
                  onClick={() => {
                    setRenamingId(matchup.id);
                    setRenameValue(matchup.name);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  data-testid="matchup-duplicate-button"
                  className="text-muted-foreground underline underline-offset-2"
                  onClick={() => store.getState().duplicateMatchup(matchup.id)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  data-testid="matchup-delete-button"
                  className="text-muted-foreground underline underline-offset-2"
                  onClick={() => requestDelete(matchup, index)}
                >
                  Delete
                </button>
              </div>

              {pendingDelete?.id === matchup.id ? (
                <div
                  role="alertdialog"
                  aria-label={`Delete ${matchup.name}?`}
                  className="border-border bg-background mt-2 rounded border p-2 text-xs"
                >
                  <p className="text-foreground">Delete &quot;{matchup.name}&quot;?</p>
                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      data-testid="matchup-delete-confirm"
                      className="font-medium text-red-600 dark:text-red-400"
                      onClick={confirmDelete}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      data-testid="matchup-delete-cancel"
                      className="text-muted-foreground"
                      onClick={() => setPendingDelete(undefined)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="space-y-1">
          <input
            ref={addInputRef}
            autoFocus
            data-testid="matchup-add-input"
            placeholder="Matchup name"
            className="border-border bg-background w-full rounded-md border px-2 py-1 text-sm"
            value={addValue}
            onChange={(event) => {
              setAddValue(event.target.value);
              setAddError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitAdd();
              if (event.key === "Escape") {
                setAdding(false);
                setAddValue("");
                setAddError(undefined);
              }
            }}
          />
          {addError ? (
            <p
              role="alert"
              data-testid="matchup-add-error"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {addError}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          data-testid="matchup-add-button"
          className="border-border w-full rounded-md border border-dashed px-2 py-1 text-sm font-medium"
          onClick={() => setAdding(true)}
        >
          + Add matchup
        </button>
      )}

      {undoMessage !== undefined ? (
        <UndoToast
          message={undoMessage}
          onUndo={undoDelete}
          onDismiss={() => setUndoMessage(undefined)}
        />
      ) : null}
    </nav>
  );
}
