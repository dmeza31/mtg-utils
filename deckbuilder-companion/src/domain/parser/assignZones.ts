/**
 * SPEC-A Task A-2 — zone assignment (FR-1.7.3). The genuinely tricky part:
 * deciding whether a line belongs to the maindeck or sideboard when the
 * input gives ambiguous or partial signals. Precedence, highest first:
 *
 * 1. Any `SB:` prefix present anywhere → the prefix alone decides.
 * 2. An explicit `Sideboard` section header present → the header decides.
 * 3. Neither → the first blank-line run with card lines on both sides
 *    splits maindeck from sideboard.
 * 4. No blank line either → everything is maindeck.
 */
import type { Zone } from "../model/types";
import type { Line } from "./tokenize";

/**
 * Which precedence rule decided the zone split (FR-1.7.3) — for telemetry
 * and the parse summary. `dekXml` is set directly by `parseDekXml.ts` (task
 * A-4), whose `Sideboard="true"/"false"` attribute makes zone precedence
 * moot — there's nothing here for this module to detect.
 */
export type DecklistVariant =
  "sbPrefix" | "sectionHeader" | "blankLineSplit" | "maindeckOnly" | "dekXml";

const SB_PREFIX = /^SB:/i;

function bySbPrefix(lines: readonly Line[]): ReadonlyMap<number, Zone> | undefined {
  const cardLines = lines.filter((l) => l.kind === "card");
  const hasSbPrefix = cardLines.some((l) => SB_PREFIX.test(l.raw.trim()));
  if (!hasSbPrefix) return undefined;

  const zones = new Map<number, Zone>();
  for (const line of cardLines) {
    zones.set(line.lineNumber, SB_PREFIX.test(line.raw.trim()) ? "sideboard" : "maindeck");
  }
  return zones;
}

function bySectionHeader(lines: readonly Line[]): ReadonlyMap<number, Zone> | undefined {
  const hasHeader = lines.some((l) => l.kind === "section");
  if (!hasHeader) return undefined;

  const zones = new Map<number, Zone>();
  let current: Zone = "maindeck";
  for (const line of lines) {
    if (line.kind === "section") {
      current = line.section === "sideboard" ? "sideboard" : "maindeck";
      continue;
    }
    if (line.kind === "card") {
      zones.set(line.lineNumber, current);
    }
  }
  return zones;
}

function byBlankLineSplit(lines: readonly Line[]): {
  zones: ReadonlyMap<number, Zone>;
  variant: "blankLineSplit" | "maindeckOnly";
} {
  let splitLineNumber: number | undefined;
  let sawCard = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    if (line.kind === "card") {
      sawCard = true;
      continue;
    }

    if (line.kind === "blank") {
      let j = i;
      while (j < lines.length && lines[j]?.kind === "blank") j++;
      const hasCardAfter = lines.slice(j).some((l) => l.kind === "card");
      if (sawCard && hasCardAfter) {
        const next = lines[j];
        splitLineNumber = next?.lineNumber;
        break;
      }
      i = j - 1; // loop's i++ advances past the run
    }
  }

  const zones = new Map<number, Zone>();
  for (const line of lines) {
    if (line.kind !== "card") continue;
    const isSideboard = splitLineNumber !== undefined && line.lineNumber >= splitLineNumber;
    zones.set(line.lineNumber, isSideboard ? "sideboard" : "maindeck");
  }
  return { zones, variant: splitLineNumber !== undefined ? "blankLineSplit" : "maindeckOnly" };
}

function computeZones(lines: readonly Line[]): {
  zones: ReadonlyMap<number, Zone>;
  variant: DecklistVariant;
} {
  const bySb = bySbPrefix(lines);
  if (bySb !== undefined) return { zones: bySb, variant: "sbPrefix" };

  const byHeader = bySectionHeader(lines);
  if (byHeader !== undefined) return { zones: byHeader, variant: "sectionHeader" };

  return byBlankLineSplit(lines);
}

export function assignZones(lines: readonly Line[]): ReadonlyMap<number, Zone> {
  return computeZones(lines).zones;
}

export function detectDecklistVariant(lines: readonly Line[]): DecklistVariant {
  return computeZones(lines).variant;
}
