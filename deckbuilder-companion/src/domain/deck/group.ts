/**
 * SPEC-B Task B-1 — grouping (FR-3.4). The React components render arrays
 * this computes; the interesting decisions (how a modal DFC categorises,
 * which face a split/adventure card uses) live here where they're
 * unit-testable at millisecond speed.
 */
import type { Card } from "../model/types";
import type { ResolvedEntry } from "./queries";

export type GroupBy = "type" | "manaValue" | "color" | "none";

export interface CardGroup {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly ResolvedEntry[];
}

// Conventional deckbuilding order — not alphabetical. A card matches the
// *first* type in this list present on its (possibly front-face) type line.
const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Battle",
  "Land",
] as const;

/** Shared with `statistics.ts` — the type breakdown uses the same categorisation as grouping. */
export type CardType = (typeof TYPE_ORDER)[number] | "Other";

const TYPE_LABELS: Readonly<Record<string, string>> = {
  Creature: "Creatures",
  Planeswalker: "Planeswalkers",
  Instant: "Instants",
  Sorcery: "Sorceries",
  Artifact: "Artifacts",
  Enchantment: "Enchantments",
  Battle: "Battles",
  Land: "Lands",
  Other: "Other",
};

/**
 * Modal DFCs, adventures, and split cards all group by their front face
 * (FR-3.4) — `card.faces[0]`, not the combined top-level `typeLine`, which
 * for a two-faced card is both faces joined and would let a lower-priority
 * back-face type outrank a front-face type that should have won.
 */
function primaryTypeLine(card: Card): string {
  return card.faces?.[0]?.typeLine ?? card.typeLine;
}

/** Exported for `statistics.ts` — the type breakdown must categorise identically to grouping. */
export function cardType(card: Card): CardType {
  const typeLine = primaryTypeLine(card);
  for (const type of TYPE_ORDER) {
    if (typeLine.includes(type)) return type;
  }
  return "Other";
}

function isLand(card: Card): boolean {
  return cardType(card) === "Land";
}

function bucket<T>(
  entries: readonly ResolvedEntry[],
  keyFor: (card: Card) => T,
): Map<T, ResolvedEntry[]> {
  const buckets = new Map<T, ResolvedEntry[]>();
  for (const entry of entries) {
    const key = keyFor(entry.card);
    const list = buckets.get(key);
    if (list === undefined) {
      buckets.set(key, [entry]);
    } else {
      list.push(entry);
    }
  }
  return buckets;
}

function groupByType(entries: readonly ResolvedEntry[]): CardGroup[] {
  const buckets = bucket(entries, cardType);
  const order: readonly CardType[] = [...TYPE_ORDER, "Other"];
  return order.flatMap((type): CardGroup[] => {
    const bucketEntries = buckets.get(type);
    if (bucketEntries === undefined || bucketEntries.length === 0) return [];
    return [{ key: type.toLowerCase(), label: TYPE_LABELS[type] ?? type, entries: bucketEntries }];
  });
}

const MANA_VALUE_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7+"] as const;

function manaValueBucket(manaValue: number): string {
  const rounded = Math.max(0, Math.floor(manaValue));
  return rounded >= 7 ? "7+" : String(rounded);
}

function groupByManaValue(entries: readonly ResolvedEntry[]): CardGroup[] {
  // FR-3.4 — lands excluded entirely from mana-value grouping; a curve with
  // 24 zero-drops is noise.
  const nonLand = entries.filter((entry) => !isLand(entry.card));
  const buckets = bucket(nonLand, (card) => manaValueBucket(card.manaValue));
  return MANA_VALUE_LABELS.flatMap((label): CardGroup[] => {
    const bucketEntries = buckets.get(label);
    if (bucketEntries === undefined || bucketEntries.length === 0) return [];
    return [{ key: label, label, entries: bucketEntries }];
  });
}

const COLOR_ORDER = ["W", "U", "B", "R", "G"] as const;
const COLOR_LABELS: Readonly<Record<string, string>> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  Multicolor: "Multicolor",
  Colorless: "Colorless",
};

/** By colour *identity*, not cast cost — a Devoid card's identity still bears its colour. */
function colorBucketKey(card: Card): string {
  if (card.colorIdentity.length === 0) return "Colorless";
  if (card.colorIdentity.length > 1) return "Multicolor";
  return card.colorIdentity[0] as string;
}

function groupByColor(entries: readonly ResolvedEntry[]): CardGroup[] {
  const buckets = bucket(entries, colorBucketKey);
  return [...COLOR_ORDER, "Multicolor", "Colorless"].flatMap((key): CardGroup[] => {
    const bucketEntries = buckets.get(key);
    if (bucketEntries === undefined || bucketEntries.length === 0) return [];
    return [{ key: key.toLowerCase(), label: COLOR_LABELS[key] ?? key, entries: bucketEntries }];
  });
}

export function groupEntries(entries: readonly ResolvedEntry[], by: GroupBy): readonly CardGroup[] {
  switch (by) {
    case "type":
      return groupByType(entries);
    case "manaValue":
      return groupByManaValue(entries);
    case "color":
      return groupByColor(entries);
    case "none":
      return [{ key: "none", label: "All Cards", entries }];
  }
}
