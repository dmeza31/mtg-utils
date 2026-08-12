"use client";

/**
 * SPEC-E Task E-4. One dialog for everything that leaves the app as a file:
 * the printable binder (FR-10.x, Markdown or PDF) and the whole-workspace
 * JSON (FR-11.1/11.2) plus "clear all local data" (FR-11.5) — grouped here
 * because they're all "get data in or out of the browser," not because the
 * binder and the workspace file are the same artifact.
 *
 * The PDF renderer is never imported at module scope: the download handler
 * reaches it via a dynamic `import()`, and the live preview via
 * `next/dynamic(..., { ssr: false })` — both keep `@react-pdf/renderer` out
 * of the initial bundle (NFR-1.5).
 */
import * as Dialog from "@radix-ui/react-dialog";
import nextDynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { buildBinder, type BinderDocument } from "@/domain/export/binder";
import { renderMarkdown } from "@/domain/export/markdown";
import { deserializeWorkspace, serializeWorkspace } from "@/domain/export/workspace";
import type { MatchupId } from "@/domain/model/types";
import { clearAllLocalData } from "@/state/clearAllLocalData";
import {
  useCardRepository,
  useWorkspaceState,
  useWorkspaceStoreApi,
} from "@/state/WorkspaceProvider";

const BinderPdfPreview = nextDynamic(() => import("./pdf/BinderPdfPreview"), {
  ssr: false,
  loading: () => (
    <p className="text-muted-foreground p-4 text-sm" data-testid="pdf-preview-loading">
      Loading PDF preview…
    </p>
  ),
});

type ExportFormat = "markdown" | "pdf" | "workspace-json";

function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "deck"
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportDialog() {
  const store = useWorkspaceStoreApi();
  const repo = useCardRepository();
  const workspace = useWorkspaceState((s) => s.workspace);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [includeNotes, setIncludeNotes] = useState(true);
  // Tracks *excluded* ids, not selected ones — a matchup added after the
  // dialog first mounted must default to included, which a "selected ids"
  // set (frozen at whatever existed at mount) would silently drop.
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<MatchupId>>(() => new Set());
  const [generating, setGenerating] = useState(false);
  const [importError, setImportError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clearConfirming, setClearConfirming] = useState(false);

  const deckName = workspace.deck?.name ?? "deck";

  const binder: BinderDocument = useMemo(
    () =>
      buildBinder(workspace, repo, {
        matchupIds: workspace.matchups.map((m) => m.id).filter((id) => !excludedIds.has(id)),
        includeNotes,
      }),
    [workspace, repo, excludedIds, includeNotes],
  );

  const toggleMatchup = (id: MatchupId) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setExcludedIds(new Set());
  const selectNone = () => setExcludedIds(new Set(workspace.matchups.map((m) => m.id)));

  const onDownload = async () => {
    if (format === "markdown") {
      const text = renderMarkdown(binder);
      downloadBlob(
        new Blob([text], { type: "text/markdown" }),
        `${slugify(deckName)}-sideboard-binder.md`,
      );
      return;
    }
    if (format === "workspace-json") {
      const text = serializeWorkspace(workspace);
      downloadBlob(
        new Blob([text], { type: "application/json" }),
        `${slugify(deckName)}-workspace.json`,
      );
      return;
    }
    setGenerating(true);
    try {
      const [{ pdf }, { BinderPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf/BinderPdfDocument"),
      ]);
      const blob = await pdf(<BinderPdfDocument doc={binder} />).toBlob();
      downloadBlob(blob, `${slugify(deckName)}-sideboard-binder.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  const onImportFile = async (file: File) => {
    setImportError(undefined);
    const text = await file.text();
    const result = deserializeWorkspace(text);
    if (!result.ok) {
      setImportError(
        result.error.type === "newer-version"
          ? `This file was made by a newer version of the app (schema v${result.error.foundVersion}). Update the app to open it.`
          : "That file isn't a valid workspace export.",
      );
      return;
    }
    store.getState().restoreWorkspace(result.value);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-testid="export-dialog-trigger"
          className="border-border rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Export
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          data-testid="export-dialog"
          className="bg-background border-border fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-4 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-foreground text-lg font-semibold">Export</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="export-dialog-close"
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <fieldset className="flex flex-wrap items-center gap-4" data-testid="export-format">
              <legend className="text-muted-foreground mb-1 text-sm">Format</legend>
              {(
                [
                  { value: "markdown", label: "Markdown" },
                  { value: "pdf", label: "PDF" },
                  { value: "workspace-json", label: "Workspace (.json)" },
                ] as const
              ).map((option) => (
                <label key={option.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="export-format"
                    data-testid={`export-format-${option.value}`}
                    checked={format === option.value}
                    onChange={() => setFormat(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            {format !== "workspace-json" ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Matchups</span>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        data-testid="export-select-all"
                        className="underline underline-offset-2"
                        onClick={selectAll}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        data-testid="export-select-none"
                        className="underline underline-offset-2"
                        onClick={selectNone}
                      >
                        Select none
                      </button>
                    </div>
                  </div>
                  <div
                    className="max-h-32 space-y-1 overflow-y-auto text-sm"
                    data-testid="export-matchup-list"
                  >
                    {workspace.matchups.map((matchup) => (
                      <label key={matchup.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          data-testid="export-matchup-checkbox"
                          checked={!excludedIds.has(matchup.id)}
                          onChange={() => toggleMatchup(matchup.id)}
                        />
                        {matchup.name}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    data-testid="export-include-notes"
                    checked={includeNotes}
                    onChange={(event) => setIncludeNotes(event.target.checked)}
                  />
                  Include per-card notes
                </label>

                <div>
                  <p className="text-muted-foreground mb-2 text-sm">Preview</p>
                  {format === "markdown" ? (
                    <pre
                      data-testid="export-preview-markdown"
                      tabIndex={0}
                      aria-label="Markdown preview"
                      className="border-border bg-muted/30 max-h-96 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap"
                    >
                      {renderMarkdown(binder)}
                    </pre>
                  ) : (
                    <div
                      data-testid="export-preview-pdf"
                      className="border-border rounded-md border"
                    >
                      <BinderPdfPreview doc={binder} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <pre
                data-testid="export-preview-workspace-json"
                tabIndex={0}
                aria-label="Workspace JSON preview"
                className="border-border bg-muted/30 max-h-96 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap"
              >
                {serializeWorkspace(workspace)}
              </pre>
            )}

            <button
              type="button"
              data-testid="export-download"
              disabled={generating}
              onClick={() => void onDownload()}
              className="border-border bg-foreground text-background rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {generating ? "Generating…" : "Download"}
            </button>

            <div className="border-border space-y-2 border-t pt-4">
              <p className="text-foreground text-sm font-semibold">Import a workspace</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                aria-label="Import a workspace file"
                data-testid="import-workspace-file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) void onImportFile(file);
                  event.target.value = "";
                }}
              />
              {importError !== undefined ? (
                <p
                  role="alert"
                  data-testid="import-workspace-error"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {importError}
                </p>
              ) : null}
            </div>

            <div className="border-border space-y-2 border-t pt-4">
              <p className="text-foreground text-sm font-semibold">Local data</p>
              {clearConfirming ? (
                <div className="flex items-center gap-2 text-sm" role="alertdialog">
                  <span>Clear all locally saved data? This can&apos;t be undone.</span>
                  <button
                    type="button"
                    data-testid="clear-local-data-confirm"
                    className="font-medium text-red-600 dark:text-red-400"
                    onClick={() => {
                      clearAllLocalData();
                      setClearConfirming(false);
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    data-testid="clear-local-data-cancel"
                    className="text-muted-foreground"
                    onClick={() => setClearConfirming(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="clear-local-data"
                  className="text-muted-foreground text-sm underline underline-offset-2"
                  onClick={() => setClearConfirming(true)}
                >
                  Clear all local data
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
