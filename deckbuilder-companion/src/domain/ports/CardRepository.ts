/**
 * SPEC-002 Task 2 — the seam described in requirements §10.3. Everything
 * above this interface is testable with `FakeCardRepository`
 * (`tests/support/FakeCardRepository.ts`); the Scryfall implementation lands
 * in SPEC-A and can be replaced by a server proxy in v2 without any caller
 * changing (NFR-6.4).
 */
import type { Card, CardId } from "../model/types";

/** A name as it appeared in an imported decklist line. */
export interface CardNameQuery {
  readonly name: string;
  /** Retained for disambiguation only — never determines artwork (D-6, FR-1.7.6). */
  readonly listedPrinting?: { set: string; collectorNumber: string };
}

/** A name that could not be resolved to a card (FR-2.10). */
export interface UnresolvedName {
  readonly name: string;
  readonly reason: string;
  readonly suggestion?: string;
}

export interface ResolveResult {
  readonly cards: ReadonlyMap<CardId, Card>;
  readonly byQueriedName: ReadonlyMap<string, CardId>;
  readonly unresolved: readonly UnresolvedName[];
}

export interface CardRepository {
  /**
   * Resolve card names to canonical identities plus oldest-print artwork.
   * Implementations MUST batch (FR-2.2, FR-2.15) and MUST NOT throw on
   * individual unresolved names — those come back in `unresolved`.
   */
  resolve(names: readonly CardNameQuery[]): Promise<ResolveResult>;

  /** Cache-only lookup. Never performs I/O. Used by export (FR-10.12). */
  peek(cardId: CardId): Card | undefined;

  /** Fuzzy suggestion for a failed name — FR-2.10. */
  suggest(name: string): Promise<string | undefined>;
}
