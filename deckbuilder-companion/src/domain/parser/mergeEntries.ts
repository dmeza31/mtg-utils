/**
 * Shared merge step (FR-1.7.7) behind both text (`parseDecklist.ts`) and
 * `.dek` XML (`parseDekXml.ts`) parsing, so the "same zone merges, cross-zone
 * doesn't, first-seen casing wins" rule lives in exactly one place.
 */
import type { Zone } from "../model/types";
import type { ParsedEntry } from "./parseDecklist";
import type { Printing } from "./tokenize";

export interface RawEntry {
  readonly name: string;
  readonly quantity: number;
  readonly zone: Zone;
  readonly printing?: Printing;
  readonly sourceLine: number;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function mergeEntries(raw: readonly RawEntry[]): readonly ParsedEntry[] {
  const merged = new Map<string, ParsedEntry>();

  for (const entry of raw) {
    const key = `${entry.zone} ${normalize(entry.name)}`;
    const existing = merged.get(key);

    if (existing === undefined) {
      merged.set(key, {
        name: entry.name,
        quantity: entry.quantity,
        zone: entry.zone,
        ...(entry.printing !== undefined ? { printing: entry.printing } : {}),
        sourceLines: [entry.sourceLine],
      });
    } else {
      merged.set(key, {
        ...existing,
        quantity: existing.quantity + entry.quantity,
        sourceLines: [...existing.sourceLines, entry.sourceLine],
      });
    }
  }

  return [...merged.values()];
}
