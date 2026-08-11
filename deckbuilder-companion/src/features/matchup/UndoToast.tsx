"use client";

/**
 * SPEC-C Task C-5 — a toast with an Undo action that stays for ~10s
 * (FR-5.6). Undo itself is `store.temporal.getState().undo()` — the zundo
 * history the workspace store already wraps every mutation in, not a
 * bespoke trash bin (SPEC-C §3 task C-3's framing).
 */
import { useEffect } from "react";

const VISIBLE_MS = 10_000;

export interface UndoToastProps {
  readonly message: string;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
}

export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      data-testid="matchup-undo-toast"
      className="border-border bg-background fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-md border px-4 py-3 shadow-lg"
    >
      <span className="text-foreground text-sm">{message}</span>
      <button
        type="button"
        data-testid="matchup-undo-button"
        className="text-accent text-sm font-medium underline underline-offset-2"
        onClick={onUndo}
      >
        Undo
      </button>
    </div>
  );
}
