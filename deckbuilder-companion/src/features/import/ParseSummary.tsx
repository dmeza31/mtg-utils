"use client";

/**
 * SPEC-A Task A-11 — shown before commit (FR-1.5): maindeck/sideboard
 * counts, detected variant, unresolved names (task A-12), and deck warnings
 * from FR-4. Warnings are dismissible banners that never block the confirm
 * button (FR-4.4 — validation is advisory, it warns, it never blocks).
 */
import { useState } from "react";
import { countCards } from "@/domain/deck/queries";
import type { ImportPreview } from "@/state/importDeck";
import { UnresolvedNameCorrections } from "./UnresolvedNameCorrections";

export interface ParseSummaryProps {
  readonly preview: ImportPreview;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly onApplySuggestion: (name: string, suggestion: string) => void;
  readonly onEditManually: () => void;
  readonly onRetry: () => void;
}

const VARIANT_LABEL: Record<string, string> = {
  sbPrefix: "SB: prefix",
  sectionHeader: "Deck / Sideboard headers",
  blankLineSplit: "blank-line separated",
  maindeckOnly: "maindeck only",
  dekXml: "MTGO .dek export",
};

export function ParseSummary({
  preview,
  onConfirm,
  onCancel,
  onApplySuggestion,
  onEditManually,
  onRetry,
}: ParseSummaryProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  if (preview.status === "error") {
    return (
      <div
        data-testid="parse-summary"
        role="alert"
        className="border-border rounded-md border p-4 text-sm"
      >
        <p className="text-foreground font-medium" data-testid="parse-summary-error-message">
          {preview.errorMessage ?? "Nothing could be parsed from that input."}
        </p>
        <div className="mt-2 flex gap-3">
          {preview.retryable ? (
            <button
              type="button"
              data-testid="parse-summary-retry"
              className="text-sm font-medium underline underline-offset-2"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
          <button
            type="button"
            data-testid="parse-summary-dismiss-error"
            className="text-sm underline underline-offset-2"
            onClick={onCancel}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const deck = preview.deck;
  const maindeckCount = deck !== undefined ? countCards(deck.maindeck) : 0;
  const sideboardCount = deck !== undefined ? countCards(deck.sideboard) : 0;
  const visibleIssues = preview.issues.filter((issue) => !dismissed.has(issue.message));

  return (
    <div data-testid="parse-summary" className="border-border space-y-4 rounded-md border p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Maindeck</dt>
          <dd data-testid="parse-summary-maindeck-count" className="text-foreground font-semibold">
            {maindeckCount}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sideboard</dt>
          <dd data-testid="parse-summary-sideboard-count" className="text-foreground font-semibold">
            {sideboardCount}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Detected format</dt>
          <dd data-testid="parse-summary-variant" className="text-foreground font-semibold">
            {preview.detectedVariant
              ? (VARIANT_LABEL[preview.detectedVariant] ?? preview.detectedVariant)
              : "—"}
          </dd>
        </div>
      </dl>

      {visibleIssues.length > 0 ? (
        <ul className="space-y-2" data-testid="deck-warnings">
          {visibleIssues.map((issue) => (
            <li
              key={issue.message}
              role="status"
              className="border-border flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              data-testid="deck-warning"
            >
              <span>{issue.message}</span>
              <button
                type="button"
                className="text-muted-foreground shrink-0 underline underline-offset-2"
                onClick={() => setDismissed((prev) => new Set(prev).add(issue.message))}
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <UnresolvedNameCorrections
        unresolved={preview.unresolved}
        parsedEntries={preview.parsedEntries}
        onApplySuggestion={onApplySuggestion}
        onEditManually={onEditManually}
      />

      <div className="flex gap-3">
        <button
          type="button"
          data-testid="parse-summary-confirm"
          className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium"
          onClick={onConfirm}
        >
          Confirm import
        </button>
        <button
          type="button"
          data-testid="parse-summary-cancel"
          className="border-border rounded-md border px-4 py-2 text-sm font-medium"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
