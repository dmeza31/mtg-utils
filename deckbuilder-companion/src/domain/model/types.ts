/**
 * SPEC-002 Task 1 — the requirements §9 domain model as TypeScript.
 *
 * Everything here is `readonly`. All mutation goes through the action
 * functions in `src/domain/plan/actions.ts` (Task 4), which is what makes
 * undo/redo (FR-8.9) a matter of keeping previous states rather than
 * implementing inverse operations.
 */

/**
 * Scryfall oracle_id. Stable across printings and reprints — this is card
 * *identity*. Branded so a `MatchupId` can never be passed where a `CardId`
 * belongs; that mixup is exactly the kind of bug that survives to
 * production if both are bare strings.
 */
export type CardId = string & { readonly __brand: "CardId" };
export type MatchupId = string & { readonly __brand: "MatchupId" };

/** Construct a `CardId` from a raw oracle id. The one sanctioned cast site. */
export function toCardId(oracleId: string): CardId {
  return oracleId as CardId;
}

/** Construct a `MatchupId` from a raw id. The one sanctioned cast site. */
export function toMatchupId(id: string): MatchupId {
  return id as MatchupId;
}

export type Zone = "maindeck" | "sideboard";
export type PlanVariant = "unified" | "onPlay" | "onDraw";

export type Format =
  "standard" | "pioneer" | "modern" | "legacy" | "vintage" | "pauper" | "unknown";

export interface CardImageUris {
  readonly small?: string;
  readonly normal?: string;
  readonly large?: string;
}

/** One face of a split, adventure, or modal double-faced card (FR-2.9, FR-2.12). */
export interface CardFace {
  readonly name: string;
  readonly manaCost?: string;
  readonly typeLine?: string;
  readonly oracleText?: string;
  readonly imageUris?: CardImageUris;
}

/** Cached, resolved from Scryfall (FR-2.12). */
export interface Card {
  readonly oracleId: CardId;
  readonly name: string;
  readonly manaCost?: string;
  readonly manaValue: number;
  readonly typeLine: string;
  readonly oracleText?: string;
  readonly colors: readonly string[];
  readonly colorIdentity: readonly string[];
  readonly rarity: string;
  readonly set: string;
  readonly collectorNumber: string;
  readonly layout: string;
  readonly imageUris?: CardImageUris;
  readonly faces?: readonly CardFace[];
  /** ISO 8601. Drives the FR-2.5 localStorage TTL. */
  readonly cachedAt: string;
  /**
   * SPEC-A FR-2.16 — set when oldest-print search (phase 2) found nothing
   * for this card and the identity lookup's (phase 1) default-printing
   * images were kept instead. Lets the UI be honest that the art shown
   * isn't necessarily the oldest paper printing.
   */
  readonly printingFallback?: boolean;
}

export interface DeckEntry {
  readonly cardId: CardId;
  readonly quantity: number;
  /** Retained from the imported list for round-trip fidelity. Never drives artwork — D-6. */
  readonly listedPrinting?: { set: string; collectorNumber: string };
}

export interface Deck {
  readonly id: string;
  readonly name: string;
  readonly format: Format;
  readonly maindeck: readonly DeckEntry[];
  readonly sideboard: readonly DeckEntry[];
  readonly importedAt: string; // ISO 8601
  readonly sourceText: string; // original paste, for re-parse and diff
}

export interface PlanEntry {
  readonly cardId: CardId;
  readonly quantity: number;
  readonly note?: string; // FR-6.7
  /**
   * Set by `reconcilePlan` (SPEC-002 Task 8) when a re-import no longer
   * supports this entry (FR-6.9). Entries are flagged, never dropped — the
   * user needs to see what they lost to decide what replaces it.
   */
  readonly broken?: boolean;
}

export interface SideboardPlan {
  readonly out: readonly PlanEntry[];
  readonly in: readonly PlanEntry[];
}

export interface Matchup {
  readonly id: MatchupId;
  readonly name: string;
  readonly priority?: "high" | "medium" | "low";
  readonly tags: readonly string[];
  readonly opponentDeck?: Deck;
  readonly gamePlan: string; // markdown
  readonly splitPlayDraw: boolean; // FR-6.8
  readonly plans: Partial<Record<PlanVariant, SideboardPlan>>;
}

export interface Workspace {
  readonly schemaVersion: 1;
  readonly deck?: Deck;
  readonly matchups: readonly Matchup[];
}
