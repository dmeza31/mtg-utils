/**
 * SPEC-B Task B-3 — deck statistics (FR-3.8). Every rule below is a
 * "reasonable people implement this differently" decision, table-tested in
 * `statistics.test.ts` against a hand-built deck.
 */
import type { CardRepository } from "../ports/CardRepository";
import type { Card, Deck } from "../model/types";
import { cardType, type CardType } from "./group";
import { countCards, resolveEntries, type ResolvedEntry } from "./queries";

export type Color = "W" | "U" | "B" | "R" | "G";

export interface ManaCurveBucket {
  readonly manaValue: number;
  readonly count: number;
}

export interface ColorPipCount {
  readonly color: Color;
  readonly count: number;
}

export interface TypeBreakdownEntry {
  readonly type: CardType;
  readonly count: number;
}

export interface DeckStatistics {
  readonly totalMaindeck: number;
  readonly totalSideboard: number;
  readonly manaCurve: readonly ManaCurveBucket[];
  readonly colorPips: readonly ColorPipCount[];
  readonly typeBreakdown: readonly TypeBreakdownEntry[];
  readonly landCount: number;
  readonly averageManaValue: number;
  /** A card the repository can't resolve is excluded rather than counted as a phantom 0-drop. */
  readonly unresolvedCount: number;
}

const COLOR_ORDER: readonly Color[] = ["W", "U", "B", "R", "G"];
const MANA_SYMBOL = /\{([^}]+)\}/g;

/** Split/modal/adventure cards carry their own cost on the front face; ordinary cards don't have `faces`. */
function frontFaceManaCost(card: Card): string | undefined {
  return card.faces?.[0]?.manaCost ?? card.manaCost;
}

/**
 * FR-3.8 — X counts as 0 (the rules-correct value off the stack). Scryfall's
 * own `cmc` already reflects this for ordinary cards; this parser only
 * matters when a front face's own cost is used instead of `card.manaValue`
 * (split/modal cards, whose combined top-level mana value follows different
 * rules than "count the front face" — SPEC-B's deliberate simplification).
 */
function manaValueFromCost(manaCost: string): number {
  let total = 0;
  for (const match of manaCost.matchAll(MANA_SYMBOL)) {
    const symbol = match[1] ?? "";
    if (/^\d+$/.test(symbol)) {
      total += Number(symbol);
      continue;
    }
    if (symbol === "X" || symbol === "Y" || symbol === "Z") continue; // X/Y/Z count as 0.
    const genericHybrid = /^(\d+)\/[WUBRGC]$/.exec(symbol);
    if (genericHybrid?.[1] !== undefined) {
      total += Number(genericHybrid[1]);
      continue;
    }
    total += 1; // Single colour, colour/colour hybrid, Phyrexian, snow, or colourless — one pip of cost.
  }
  return total;
}

/** FR-3.8 — split/modal cards count the front face for curve purposes. */
function frontFaceManaValue(card: Card): number {
  const frontManaCost = card.faces?.[0]?.manaCost;
  if (frontManaCost !== undefined) return manaValueFromCost(frontManaCost);
  return card.manaValue;
}

/** Hybrid symbols count toward every colour they contain; generic mana is never a pip. */
function pipsIn(manaCost: string | undefined): readonly Color[] {
  if (manaCost === undefined) return [];
  const pips: Color[] = [];
  for (const match of manaCost.matchAll(MANA_SYMBOL)) {
    const symbol = match[1] ?? "";
    for (const color of COLOR_ORDER) {
      if (symbol.includes(color)) pips.push(color);
    }
  }
  return pips;
}

function computeManaCurve(nonLand: readonly ResolvedEntry[]): {
  manaCurve: readonly ManaCurveBucket[];
  averageManaValue: number;
} {
  const buckets = new Map<number, number>();
  let weightedTotal = 0;
  let count = 0;

  for (const entry of nonLand) {
    const manaValue = Math.max(0, Math.floor(frontFaceManaValue(entry.card)));
    buckets.set(manaValue, (buckets.get(manaValue) ?? 0) + entry.quantity);
    weightedTotal += manaValue * entry.quantity;
    count += entry.quantity;
  }

  const manaCurve = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([manaValue, bucketCount]) => ({ manaValue, count: bucketCount }));

  return { manaCurve, averageManaValue: count > 0 ? weightedTotal / count : 0 };
}

function computeColorPips(entries: readonly ResolvedEntry[]): readonly ColorPipCount[] {
  const counts = new Map<Color, number>();
  for (const entry of entries) {
    for (const color of pipsIn(frontFaceManaCost(entry.card))) {
      counts.set(color, (counts.get(color) ?? 0) + entry.quantity);
    }
  }
  return COLOR_ORDER.map((color) => ({ color, count: counts.get(color) ?? 0 }));
}

function computeTypeBreakdown(entries: readonly ResolvedEntry[]): readonly TypeBreakdownEntry[] {
  const counts = new Map<CardType, number>();
  for (const entry of entries) {
    const type = cardType(entry.card);
    counts.set(type, (counts.get(type) ?? 0) + entry.quantity);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

export function computeStatistics(deck: Deck, repo: CardRepository): DeckStatistics {
  const totalMaindeck = countCards(deck.maindeck);
  const totalSideboard = countCards(deck.sideboard);

  const resolved = resolveEntries(deck, "maindeck", repo);
  const resolvedCount = resolved.reduce((sum, entry) => sum + entry.quantity, 0);

  const lands = resolved.filter((entry) => cardType(entry.card) === "Land");
  const nonLand = resolved.filter((entry) => cardType(entry.card) !== "Land");
  const landCount = lands.reduce((sum, entry) => sum + entry.quantity, 0);

  const { manaCurve, averageManaValue } = computeManaCurve(nonLand);

  return {
    totalMaindeck,
    totalSideboard,
    manaCurve,
    colorPips: computeColorPips(resolved),
    typeBreakdown: computeTypeBreakdown(resolved),
    landCount,
    averageManaValue,
    unresolvedCount: totalMaindeck - resolvedCount,
  };
}
