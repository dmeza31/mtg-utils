/**
 * SPEC-002 Task 4 — the core of the product. Every action is pure: it takes
 * a `SideboardPlan` and returns a new one, which is what makes undo/redo
 * (FR-8.9) a matter of keeping previous states rather than implementing
 * inverse operations.
 */
import { copiesOf } from "../deck/queries";
import type { CardId, Deck, PlanEntry, SideboardPlan, Zone } from "../model/types";

export interface PlanContext {
  readonly deck: Deck;
}

function clamp(quantity: number, max: number): number {
  return Math.max(0, Math.min(quantity, max));
}

/**
 * Sets a card's quantity in an entry list. Zero removes the entry rather
 * than leaving a zero-quantity row; a non-zero quantity preserves any
 * existing note (invariant 9 — notes survive quantity changes).
 */
function withQuantity(
  entries: readonly PlanEntry[],
  cardId: CardId,
  quantity: number,
): readonly PlanEntry[] {
  if (quantity <= 0) {
    return entries.filter((entry) => entry.cardId !== cardId);
  }

  const existing = entries.find((entry) => entry.cardId === cardId);
  if (existing === undefined) {
    return [...entries, { cardId, quantity }];
  }
  return entries.map((entry) => (entry.cardId === cardId ? { ...entry, quantity } : entry));
}

function quantityOf(entries: readonly PlanEntry[], cardId: CardId): number {
  return entries.find((entry) => entry.cardId === cardId)?.quantity ?? 0;
}

function setZoneQuantity(
  plan: SideboardPlan,
  ctx: PlanContext,
  side: "out" | "in",
  deckZone: Zone,
  cardId: CardId,
  quantity: number,
): SideboardPlan {
  const entries = side === "out" ? plan.out : plan.in;
  const max = copiesOf(ctx.deck, cardId, deckZone);
  const next = withQuantity(entries, cardId, clamp(quantity, max));
  return side === "out" ? { ...plan, out: next } : { ...plan, in: next };
}

export function setOutQuantity(
  plan: SideboardPlan,
  ctx: PlanContext,
  cardId: CardId,
  quantity: number,
): SideboardPlan {
  return setZoneQuantity(plan, ctx, "out", "maindeck", cardId, quantity);
}

export function setInQuantity(
  plan: SideboardPlan,
  ctx: PlanContext,
  cardId: CardId,
  quantity: number,
): SideboardPlan {
  return setZoneQuantity(plan, ctx, "in", "sideboard", cardId, quantity);
}

export function addOut(
  plan: SideboardPlan,
  ctx: PlanContext,
  cardId: CardId,
  qty = 1,
): SideboardPlan {
  return setOutQuantity(plan, ctx, cardId, quantityOf(plan.out, cardId) + qty);
}

export function addIn(
  plan: SideboardPlan,
  ctx: PlanContext,
  cardId: CardId,
  qty = 1,
): SideboardPlan {
  return setInQuantity(plan, ctx, cardId, quantityOf(plan.in, cardId) + qty);
}

export function setEntryNote(
  plan: SideboardPlan,
  side: "out" | "in",
  cardId: CardId,
  note: string,
): SideboardPlan {
  const entries = side === "out" ? plan.out : plan.in;
  const next = entries.map((entry) => (entry.cardId === cardId ? { ...entry, note } : entry));
  return side === "out" ? { ...plan, out: next } : { ...plan, in: next };
}

export function clearPlan(plan: SideboardPlan): SideboardPlan {
  return { ...plan, out: [], in: [] };
}
