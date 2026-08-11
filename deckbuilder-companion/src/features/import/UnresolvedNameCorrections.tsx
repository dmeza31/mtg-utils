/**
 * SPEC-A Task A-12 — for each unresolved name: the raw line, its line
 * number, the reason, and — where a fuzzy match exists — a one-click
 * "Did you mean X?" fix. Manual edit always falls back to the textarea.
 */
import type { ParsedEntry } from "@/domain/parser/parseDecklist";
import type { UnresolvedName } from "@/domain/ports/CardRepository";

export interface UnresolvedNameCorrectionsProps {
  readonly unresolved: readonly UnresolvedName[];
  readonly parsedEntries: readonly ParsedEntry[];
  readonly onApplySuggestion: (name: string, suggestion: string) => void;
  readonly onEditManually: () => void;
}

function lineNumbersFor(name: string, parsedEntries: readonly ParsedEntry[]): readonly number[] {
  return parsedEntries.find((entry) => entry.name === name)?.sourceLines ?? [];
}

export function UnresolvedNameCorrections({
  unresolved,
  parsedEntries,
  onApplySuggestion,
  onEditManually,
}: UnresolvedNameCorrectionsProps) {
  if (unresolved.length === 0) return null;

  return (
    <div data-testid="unresolved-names" className="space-y-2">
      <h3 className="text-foreground text-sm font-semibold">
        {unresolved.length} card{unresolved.length === 1 ? "" : "s"} could not be resolved
      </h3>
      <ul className="space-y-2">
        {unresolved.map((entry) => {
          const lines = lineNumbersFor(entry.name, parsedEntries);
          return (
            <li
              key={entry.name}
              data-testid="unresolved-name-item"
              className="border-border rounded-md border px-3 py-2 text-sm"
            >
              <p className="text-foreground">
                Line {lines.join(", ") || "?"}: <span className="font-mono">{entry.name}</span>
              </p>
              <p className="text-muted-foreground">{entry.reason}</p>
              <div className="mt-1 flex gap-3">
                {entry.suggestion ? (
                  <button
                    type="button"
                    data-testid="unresolved-name-suggestion"
                    className="text-sm font-medium underline underline-offset-2"
                    onClick={() => onApplySuggestion(entry.name, entry.suggestion as string)}
                  >
                    Did you mean {entry.suggestion}?
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="unresolved-name-edit-manually"
                  className="text-muted-foreground text-sm underline underline-offset-2"
                  onClick={onEditManually}
                >
                  Edit manually
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
