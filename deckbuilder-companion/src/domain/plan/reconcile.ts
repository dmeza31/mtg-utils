/**
 * SPEC-002 Task 8 (FR-6.9, story A4) — the subtle one. Rule 3 is the
 * requirement most likely to be implemented wrong by reflex: a broken entry
 * is KEPT and flagged, never deleted, so the user can see what they lost
 * before deciding what replaces it.
 */
import { copiesOf, totalCopiesIn75 } from "../deck/queries";
import type { CardId, Deck, PlanEntry, SideboardPlan, Zone } from "../model/types";

export type ReconcileChangeKind = "reduced" | "broken" | "moved";

export interface ReconcileChange {
  readonly kind: ReconcileChangeKind;
  readonly side: "out" | "in";
  readonly cardId: CardId;
  /** Copies available in the relevant zone before/after the re-import. */
  readonly from: number;
  readonly to: number;
}

export interface ReconcileResult {
  readonly plan: SideboardPlan;
  readonly changes: readonly ReconcileChange[];
}

function withQuantity(entry: PlanEntry, quantity: number): PlanEntry {
  return entry.note !== undefined
    ? { cardId: entry.cardId, quantity, note: entry.note }
    : { cardId: entry.cardId, quantity };
}

function asBroken(entry: PlanEntry): PlanEntry {
  return entry.note !== undefined
    ? { cardId: entry.cardId, quantity: entry.quantity, note: entry.note, broken: true }
    : { cardId: entry.cardId, quantity: entry.quantity, broken: true };
}

function reconcileSide(
  entries: readonly PlanEntry[],
  side: "out" | "in",
  oldDeck: Deck,
  newDeck: Deck,
  zone: Zone,
): { entries: readonly PlanEntry[]; changes: readonly ReconcileChange[] } {
  const changes: ReconcileChange[] = [];

  const nextEntries = entries.map((entry): PlanEntry => {
    const before = copiesOf(oldDeck, entry.cardId, zone);
    const after = copiesOf(newDeck, entry.cardId, zone);

    if (after >= entry.quantity) {
      return withQuantity(entry, entry.quantity);
    }

    if (after > 0) {
      changes.push({ kind: "reduced", side, cardId: entry.cardId, from: before, to: after });
      return withQuantity(entry, after);
    }

    const stillInDeck = totalCopiesIn75(newDeck, entry.cardId) > 0;
    changes.push({
      kind: stillInDeck ? "moved" : "broken",
      side,
      cardId: entry.cardId,
      from: before,
      to: after,
    });
    return asBroken(entry);
  });

  return { entries: nextEntries, changes };
}

/** Never invents entries: it only ever revisits what the plan already had. */
export function reconcilePlan(plan: SideboardPlan, oldDeck: Deck, newDeck: Deck): ReconcileResult {
  const out = reconcileSide(plan.out, "out", oldDeck, newDeck, "maindeck");
  const inSide = reconcileSide(plan.in, "in", oldDeck, newDeck, "sideboard");

  return {
    plan: { out: out.entries, in: inSide.entries },
    changes: [...out.changes, ...inSide.changes],
  };
}
