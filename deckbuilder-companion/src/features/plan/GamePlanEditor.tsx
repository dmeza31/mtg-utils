"use client";

/**
 * SPEC-D Task D-8 (FR-6.6). Plain-text textarea with a Markdown preview
 * toggle, autosaving to the store on debounce — no explicit save button.
 * `rehype-sanitize` on the preview is what makes `<script>` in a pasted
 * game plan inert rather than executed (NFR-5.3).
 */
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import type { MatchupId } from "@/domain/model/types";
import { useWorkspaceStoreApi } from "@/state/WorkspaceProvider";

export interface GamePlanEditorProps {
  readonly matchupId: MatchupId;
  readonly gamePlan: string;
}

const AUTOSAVE_DELAY_MS = 400;

export function GamePlanEditor({ matchupId, gamePlan }: GamePlanEditorProps) {
  const store = useWorkspaceStoreApi();
  const [draft, setDraft] = useState(gamePlan);
  const [previewOpen, setPreviewOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Switching matchups, or an external change (undo/redo, our own debounce
  // flush syncing back) — React's documented "adjust state during render"
  // pattern, so this doesn't need an effect (and doesn't cascade a render).
  const [prevMatchupId, setPrevMatchupId] = useState(matchupId);
  const [prevGamePlan, setPrevGamePlan] = useState(gamePlan);
  if (matchupId !== prevMatchupId || gamePlan !== prevGamePlan) {
    setPrevMatchupId(matchupId);
    setPrevGamePlan(gamePlan);
    setDraft(gamePlan);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const onChange = (value: string) => {
    setDraft(value);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      store.getState().setGamePlan(matchupId, value);
    }, AUTOSAVE_DELAY_MS);
  };

  // Losing focus (switching matchups, clicking elsewhere) flushes immediately
  // rather than leaving a debounce window where a fast navigation could lose
  // the edit — "no explicit save button" still means nothing gets dropped.
  const flush = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    store.getState().setGamePlan(matchupId, draft);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Game plan</h3>
        <button
          type="button"
          data-testid="game-plan-preview-toggle"
          aria-pressed={previewOpen}
          className="text-muted-foreground text-xs underline underline-offset-2"
          onClick={() => setPreviewOpen((v) => !v)}
        >
          {previewOpen ? "Edit" : "Preview"}
        </button>
      </div>

      {previewOpen ? (
        <div
          data-testid="game-plan-preview"
          className="border-border bg-muted/30 min-h-32 w-full rounded-md border p-2 text-sm [&_em]:italic [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
        >
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{draft}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          data-testid="game-plan-editor"
          className="border-border bg-background h-32 w-full rounded-md border p-2 text-sm"
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onBlur={flush}
          placeholder="**Race them.** Board out slow cards, board in interaction."
        />
      )}
    </div>
  );
}
