/**
 * SPEC-A Task A-3 — tokenize, assign zones, and merge into a `ParsedDecklist`.
 * Still pure and synchronous; still knows nothing about whether a name
 * resolves to a real card (that's `CardRepository.resolve`, task A-8).
 */
import type { Zone } from "../model/types";
import { assignZones, detectDecklistVariant, type DecklistVariant } from "./assignZones";
import { mergeEntries, type RawEntry } from "./mergeEntries";
import { tokenizeLines, type Printing } from "./tokenize";

export interface ParsedEntry {
  readonly name: string;
  readonly quantity: number;
  readonly zone: Zone;
  readonly printing?: Printing;
  readonly sourceLines: readonly number[];
}

export interface ParseProblem {
  readonly lineNumber: number;
  readonly raw: string;
  readonly reason: string;
}

export interface ParsedDecklist {
  readonly entries: readonly ParsedEntry[];
  readonly problems: readonly ParseProblem[];
  readonly detectedVariant: DecklistVariant;
}

export function parseDecklist(input: string): ParsedDecklist {
  const lines = tokenizeLines(input);
  const zones = assignZones(lines);
  const detectedVariant = detectDecklistVariant(lines);

  const problems: ParseProblem[] = [];
  const raw: RawEntry[] = [];

  for (const line of lines) {
    if (line.kind === "unparseable") {
      problems.push({ lineNumber: line.lineNumber, raw: line.raw, reason: line.reason });
      continue;
    }
    if (line.kind !== "card") continue;

    raw.push({
      name: line.name,
      quantity: line.quantity,
      zone: zones.get(line.lineNumber) ?? "maindeck",
      ...(line.printing !== undefined ? { printing: line.printing } : {}),
      sourceLine: line.lineNumber,
    });
  }

  return { entries: mergeEntries(raw), problems, detectedVariant };
}
