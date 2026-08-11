/**
 * SPEC-A Task A-9 — import orchestration, split into two phases so the UI
 * can show the parse summary *before* anything replaces the current deck
 * (FR-1.5):
 *
 *   previewImport:  parseDecklist → resolve names → build Deck → validateDeck
 *   commitImport:   setDeck → reconcile plans (SPEC-002 task 8)
 *
 * `previewImport` still drives the store's progress states (`parsing` →
 * `resolving` → `ready` | `partial` | `error`) so the UI has a real loading
 * state instead of a spinner of unknown duration on a cold-cache 75-card
 * import — it just stops short of replacing `workspace.deck`.
 */
import type { CardRepository, CardNameQuery, UnresolvedName } from "../domain/ports/CardRepository";
import type { IdFactory } from "../domain/model/ids";
import type { Deck, DeckEntry, MatchupId, PlanVariant, Zone } from "../domain/model/types";
import { validateDeck, type DeckIssue } from "../domain/deck/validate";
import { parseDecklist, type ParsedEntry, type ParseProblem } from "../domain/parser/parseDecklist";
import { parseDekXml } from "../domain/parser/parseDekXml";
import type { DecklistVariant } from "../domain/parser/assignZones";
import { reconcilePlan, type ReconcileChange } from "../domain/plan/reconcile";
import type { createWorkspaceStore } from "./workspaceStore";

type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

export interface ImportDeckOptions {
  /** Used only to decide `.dek` XML vs. plain text (FR-1.3). */
  readonly fileName?: string;
  readonly deckName?: string;
}

export interface MatchupReconciliation {
  readonly matchupId: MatchupId;
  readonly variant: PlanVariant;
  readonly changes: readonly ReconcileChange[];
}

export interface ImportPreview {
  readonly status: "ready" | "partial" | "error";
  /** Present unless `status === "error"` (nothing parsed, or resolution failed outright). */
  readonly deck?: Deck;
  readonly unresolved: readonly UnresolvedName[];
  readonly issues: readonly DeckIssue[];
  readonly parseProblems: readonly ParseProblem[];
  readonly detectedVariant?: DecklistVariant;
  /**
   * Every parsed entry, resolved or not — task A-12 needs an unresolved
   * name's original line number and zone to point at the failing line and
   * to fix it in place without a re-paste.
   */
  readonly parsedEntries: readonly ParsedEntry[];
  /**
   * NFR-4.2 — set when `status === "error"` because the network call itself
   * failed (never on "nothing parsed"). Distinguishes "nothing to import"
   * from "something went wrong, try again" so the UI can offer a retry
   * affordance instead of a dead end.
   */
  readonly errorMessage?: string;
  readonly retryable?: boolean;
}

export interface CommitResult {
  readonly reconciliations: readonly MatchupReconciliation[];
}

function isDekXml(fileName: string | undefined): boolean {
  return fileName !== undefined && fileName.toLowerCase().endsWith(".dek");
}

/** Parses and resolves a decklist into a not-yet-committed `Deck` (FR-1.5). */
export async function previewImport(
  store: WorkspaceStore,
  repository: CardRepository,
  idFactory: IdFactory,
  sourceText: string,
  options: ImportDeckOptions = {},
): Promise<ImportPreview> {
  store.setState({ status: "parsing" });
  const parsed = isDekXml(options.fileName) ? parseDekXml(sourceText) : parseDecklist(sourceText);

  if (parsed.entries.length === 0) {
    store.setState({ status: "error" });
    return {
      status: "error",
      unresolved: [],
      issues: [],
      parseProblems: parsed.problems,
      parsedEntries: [],
    };
  }

  store.setState({ status: "resolving" });

  const queries: CardNameQuery[] = parsed.entries.map((entry) => ({
    name: entry.name,
    ...(entry.printing !== undefined ? { listedPrinting: entry.printing } : {}),
  }));

  let resolveResult;
  try {
    resolveResult = await repository.resolve(queries);
  } catch {
    // NFR-4.2 — a total resolution failure (network down, Scryfall 5xx
    // exhausting retries) must surface a clear, retryable error, never an
    // unhandled rejection that leaves the UI stuck on a loading spinner.
    store.setState({ status: "error" });
    return {
      status: "error",
      unresolved: [],
      issues: [],
      parseProblems: parsed.problems,
      parsedEntries: parsed.entries,
      errorMessage:
        "Could not reach Scryfall to resolve card names. Check your connection and try again.",
      retryable: true,
    };
  }

  const toDeckEntries = (zone: Zone): DeckEntry[] =>
    parsed.entries
      .filter((entry) => entry.zone === zone)
      .flatMap((entry): DeckEntry[] => {
        const cardId = resolveResult.byQueriedName.get(entry.name);
        if (cardId === undefined) return [];
        return [
          {
            cardId,
            quantity: entry.quantity,
            ...(entry.printing !== undefined ? { listedPrinting: entry.printing } : {}),
          },
        ];
      });

  const previousDeck = store.getState().workspace.deck;
  const deck: Deck = {
    id: idFactory.next(),
    name: options.deckName ?? previousDeck?.name ?? "Imported Deck",
    format: previousDeck?.format ?? "unknown",
    maindeck: toDeckEntries("maindeck"),
    sideboard: toDeckEntries("sideboard"),
    importedAt: new Date().toISOString(),
    sourceText,
  };

  const issues = validateDeck(deck, repository);
  const status: ImportPreview["status"] =
    resolveResult.unresolved.length > 0 || issues.length > 0 ? "partial" : "ready";
  store.setState({ status });

  return {
    status,
    deck,
    unresolved: resolveResult.unresolved,
    issues,
    parseProblems: parsed.problems,
    detectedVariant: parsed.detectedVariant,
    parsedEntries: parsed.entries,
  };
}

/** Replaces `workspace.deck` with the preview's deck and reconciles every matchup's plans. */
export function commitImport(store: WorkspaceStore, preview: ImportPreview): CommitResult {
  const { deck } = preview;
  if (deck === undefined) {
    return { reconciliations: [] };
  }

  const previousDeck = store.getState().workspace.deck;
  store.getState().setDeck(deck);

  const reconciliations: MatchupReconciliation[] = [];
  if (previousDeck !== undefined) {
    for (const matchup of store.getState().workspace.matchups) {
      for (const variant of Object.keys(matchup.plans) as PlanVariant[]) {
        const plan = matchup.plans[variant];
        if (plan === undefined) continue;

        const { plan: nextPlan, changes } = reconcilePlan(plan, previousDeck, deck);
        if (changes.length > 0) {
          reconciliations.push({ matchupId: matchup.id, variant, changes });
        }
        store.getState().editPlan(matchup.id, variant, () => nextPlan);
      }
    }
  }

  store.setState({ status: preview.status === "error" ? "ready" : preview.status });
  return { reconciliations };
}
