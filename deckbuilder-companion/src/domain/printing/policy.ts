/**
 * SPEC-A Task A-5 — printing eligibility and oldest-print selection
 * (FR-2.13, FR-2.14, D-6). Pure, no I/O, exhaustively testable.
 *
 * FR-2.14 requires determinism: two users, or the same user twice, must
 * never see different art for the same card. `selectOldestPrinting` sorts
 * with a total order (date, then three tiebreak levels) so no two distinct
 * candidates ever compare equal.
 */
import type { CardImageUris } from "../model/types";

export interface PrintingCandidate {
  readonly id: string;
  readonly set: string;
  readonly setType: string;
  /** ISO date. */
  readonly releasedAt: string;
  readonly games: readonly string[];
  readonly digital: boolean;
  readonly collectorNumber: string;
  readonly imageUris?: CardImageUris;
}

const INELIGIBLE_SET_TYPES = new Set(["memorabilia", "token", "minigame", "alchemy"]);

function hasUsableImage(imageUris: CardImageUris | undefined): boolean {
  return (
    imageUris !== undefined &&
    (imageUris.small !== undefined ||
      imageUris.normal !== undefined ||
      imageUris.large !== undefined)
  );
}

export function isEligiblePrinting(candidate: PrintingCandidate): boolean {
  return (
    candidate.games.includes("paper") &&
    !candidate.digital &&
    !INELIGIBLE_SET_TYPES.has(candidate.setType) &&
    hasUsableImage(candidate.imageUris)
  );
}

function compareCollectorNumber(a: string, b: string): number {
  const numA = Number.parseInt(a, 10);
  const numB = Number.parseInt(b, 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareCandidates(a: PrintingCandidate, b: PrintingCandidate): number {
  if (a.releasedAt !== b.releasedAt) {
    return a.releasedAt < b.releasedAt ? -1 : 1;
  }

  const aPromo = a.setType === "promo";
  const bPromo = b.setType === "promo";
  if (aPromo !== bPromo) {
    return aPromo ? 1 : -1;
  }

  if (a.set !== b.set) {
    return a.set < b.set ? -1 : 1;
  }

  return compareCollectorNumber(a.collectorNumber, b.collectorNumber);
}

export function selectOldestPrinting(
  candidates: readonly PrintingCandidate[],
): PrintingCandidate | undefined {
  const eligible = candidates.filter(isEligiblePrinting);
  if (eligible.length === 0) return undefined;
  return [...eligible].sort(compareCandidates)[0];
}
