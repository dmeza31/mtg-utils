"use client";

/**
 * SPEC-A Task A-10 (stories A1, A2) — paste or upload a decklist. The
 * confirm/cancel step and reconciliation summary live in `ParseSummary` /
 * this component's post-commit state (tasks A-11, A-13); "Did you mean X?"
 * corrections live in `UnresolvedNameCorrections` (task A-12).
 */
import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  useCardRepository,
  useIdFactory,
  useWorkspaceState,
  useWorkspaceStoreApi,
} from "@/state/WorkspaceProvider";
import {
  commitImport,
  previewImport,
  type ImportPreview,
  type MatchupReconciliation,
} from "@/state/importDeck";
import { ParseSummary } from "./ParseSummary";

// NFR-5.4 — 1 MB cap, plain-text/XML read only.
const MAX_FILE_BYTES = 1024 * 1024;
const ACCEPTED_EXTENSIONS = /\.(txt|dek)$/i;

const CHANGE_LABEL: Record<MatchupReconciliation["changes"][number]["kind"], string> = {
  reduced: "reduced",
  broken: "broken",
  moved: "moved to a different zone",
};

export function ImportScreen() {
  const store = useWorkspaceStoreApi();
  const repository = useCardRepository();
  const idFactory = useIdFactory();
  const status = useWorkspaceState((s) => s.status);
  const hasExistingDeck = useWorkspaceState((s) => s.workspace.deck !== undefined);
  const matchups = useWorkspaceState((s) => s.workspace.matchups);

  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<ImportPreview | undefined>(undefined);
  const [reconciliations, setReconciliations] = useState<
    readonly MatchupReconciliation[] | undefined
  >(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = status === "parsing" || status === "resolving";

  const runPreview = useCallback(
    async (input: string, name: string | undefined) => {
      setReconciliations(undefined);
      const result = await previewImport(
        store,
        repository,
        idFactory,
        input,
        name ? { fileName: name } : {},
      );
      setPreview(result);
    },
    [store, repository, idFactory],
  );

  const readFile = useCallback(async (file: File) => {
    setFileError(undefined);
    if (!ACCEPTED_EXTENSIONS.test(file.name)) {
      setFileError("Only .txt and .dek files are supported.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File is larger than 1 MB.");
      return;
    }
    const content = await file.text();
    setText(content);
    setFileName(file.name);
  }, []);

  const onFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void readFile(file);
    },
    [readFile],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) void readFile(file);
    },
    [readFile],
  );

  const handleImportClick = useCallback(() => {
    void runPreview(text, fileName);
  }, [runPreview, text, fileName]);

  const handleConfirm = useCallback(() => {
    if (preview === undefined) return;
    const { reconciliations: changes } = commitImport(store, preview);
    setReconciliations(changes);
    setPreview(undefined);
    setText("");
    setFileName(undefined);
  }, [store, preview]);

  const handleCancel = useCallback(() => {
    setPreview(undefined);
  }, []);

  const handleApplySuggestion = useCallback(
    (name: string, suggestion: string) => {
      const corrected = text.split(name).join(suggestion);
      setText(corrected);
      void runPreview(corrected, fileName);
    },
    [text, fileName, runPreview],
  );

  const handleEditManually = useCallback(() => {
    setPreview(undefined);
    textareaRef.current?.focus();
  }, []);

  const handleRetry = useCallback(() => {
    void runPreview(text, fileName);
  }, [runPreview, text, fileName]);

  return (
    <div className="space-y-4" data-testid="import-screen">
      <div
        className="border-border rounded-md border border-dashed p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        data-testid="import-dropzone"
      >
        <label className="text-foreground block text-sm font-medium" htmlFor="import-textarea">
          Paste a decklist
        </label>
        <textarea
          id="import-textarea"
          ref={textareaRef}
          data-testid="import-textarea"
          className="border-border bg-background mt-2 h-64 w-full rounded-md border p-3 font-mono text-sm"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setFileName(undefined);
          }}
          placeholder={"4 Lightning Bolt\n4 Monastery Swiftspear\n..."}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* `min-w-0` overrides the flex item default of `min-width: auto`,
              which otherwise refuses to let a native file input shrink
              below its "Choose File" button + filename's intrinsic content
              width — the exact cause of horizontal overflow at 320px
              (NFR-3.2) that this input's default sizing would otherwise
              produce regardless of the flex container's own width. */}
          <input
            type="file"
            accept=".txt,.dek"
            aria-label="Upload a decklist file"
            data-testid="import-file-input"
            className="max-w-full min-w-0 text-sm"
            onChange={onFileInputChange}
          />
          {fileName ? <span className="text-muted-foreground text-sm">{fileName}</span> : null}
        </div>
        {fileError ? (
          <p role="alert" data-testid="import-file-error" className="mt-2 text-sm text-red-600">
            {fileError}
          </p>
        ) : null}
      </div>

      {hasExistingDeck && preview === undefined ? (
        <p
          role="status"
          data-testid="import-reimport-warning"
          className="text-muted-foreground text-sm"
        >
          Importing will replace your current deck. Sideboard plans referencing removed or reduced
          cards will be flagged, not deleted.
        </p>
      ) : null}

      <button
        type="button"
        data-testid="import-submit"
        className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        disabled={text.trim() === "" || isBusy}
        onClick={handleImportClick}
      >
        {isBusy ? "Importing…" : "Import"}
      </button>

      {preview ? (
        <ParseSummary
          preview={preview}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onApplySuggestion={handleApplySuggestion}
          onEditManually={handleEditManually}
          onRetry={handleRetry}
        />
      ) : null}

      {reconciliations ? (
        <div
          data-testid="reconciliation-summary"
          className="border-border rounded-md border p-4 text-sm"
        >
          {reconciliations.length === 0 ? (
            <p className="text-muted-foreground">
              Every matchup&apos;s sideboard plan is unaffected.
            </p>
          ) : (
            <ul className="space-y-1">
              {reconciliations.map((r) => {
                const matchupName = matchups.find((m) => m.id === r.matchupId)?.name ?? r.matchupId;
                return (
                  <li key={`${r.matchupId}-${r.variant}`} data-testid="reconciliation-item">
                    <span className="text-foreground font-medium">{matchupName}</span>
                    {": "}
                    {r.changes.map((c) => CHANGE_LABEL[c.kind]).join(", ")}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
