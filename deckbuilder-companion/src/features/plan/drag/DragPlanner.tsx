"use client";

/**
 * SPEC-D Task D-4/D-5 (FR-8.x). Four zones over `@dnd-kit/core`. Reads the
 * same `plan` the list mode reads and calls the same SPEC-002 `actions.ts`
 * functions (§2's architectural rule) — there is no drag-mode-local plan
 * state here, only which card is currently being carried.
 *
 * Keyboard support (D-5, FR-8.6) is a custom interaction layer rather than
 * dnd-kit's `KeyboardSensor` — see "Deviations from this spec as written"
 * in the spec doc for why. Tab reaches a card via its native tabIndex,
 * Space/Enter pick up and drop, arrow keys jump between the four zones by
 * name (not by pixel delta), Escape cancels. An `aria-live` region
 * announces every step, including the post-drop totals (NFR-2.6).
 */
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { resolveEntries, type ResolvedEntry } from "@/domain/deck/queries";
import {
  addIn,
  addOut,
  setEntryNote,
  setInQuantity,
  setOutQuantity,
  type PlanContext,
} from "@/domain/plan/actions";
import {
  maindeckAvailability,
  sideboardAvailability,
  type CardAvailability,
} from "@/domain/plan/availability";
import type {
  CardId,
  Deck,
  MatchupId,
  PlanEntry,
  PlanVariant,
  SideboardPlan,
} from "@/domain/model/types";
import { useCardRepository, useWorkspaceStoreApi } from "@/state/WorkspaceProvider";

export interface DragPlannerProps {
  readonly matchupId: MatchupId;
  readonly variant: PlanVariant;
  readonly deck: Deck;
  readonly plan: SideboardPlan;
}

type ZoneId = "maindeck-source" | "out-zone" | "sideboard-source" | "in-zone";

const ZONE_LABEL: Record<ZoneId, string> = {
  "maindeck-source": "maindeck",
  "out-zone": "OUT",
  "sideboard-source": "sideboard",
  "in-zone": "IN",
};

// origin zone -> valid drop zone. Everything else is rejected (FR-8.4).
const VALID_TARGET: Partial<Record<ZoneId, ZoneId>> = {
  "maindeck-source": "out-zone",
  "sideboard-source": "in-zone",
  "out-zone": "maindeck-source",
  "in-zone": "sideboard-source",
};

// Keyboard zone-to-zone navigation (D-5) — a 2x2 grid, arrows jump by name.
const ZONE_GRID: Record<
  ZoneId,
  Partial<Record<"ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", ZoneId>>
> = {
  "maindeck-source": { ArrowRight: "out-zone", ArrowDown: "sideboard-source" },
  "out-zone": { ArrowLeft: "maindeck-source", ArrowDown: "in-zone" },
  "sideboard-source": { ArrowRight: "in-zone", ArrowUp: "maindeck-source" },
  "in-zone": { ArrowLeft: "sideboard-source", ArrowUp: "out-zone" },
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const listener = () => setReduced(mql.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);
  return reduced;
}

interface Row {
  readonly entry: ResolvedEntry;
  readonly availability: CardAvailability;
}

function buildSourceRows(
  deck: Deck,
  zone: "maindeck" | "sideboard",
  plan: SideboardPlan,
  repo: Parameters<typeof resolveEntries>[2],
): readonly Row[] {
  const entries = resolveEntries(deck, zone, repo);
  const availability =
    zone === "maindeck" ? maindeckAvailability(deck, plan) : sideboardAvailability(deck, plan);
  const byCardId = new Map(availability.map((a) => [a.cardId, a]));
  return entries.flatMap((entry): Row[] => {
    const a = byCardId.get(entry.cardId);
    if (a === undefined) return [];
    return [{ entry, availability: a }];
  });
}

function planEntryRows(
  entries: readonly PlanEntry[],
  deck: Deck,
  repo: Parameters<typeof resolveEntries>[2],
): ReadonlyArray<{ entry: PlanEntry; card: ResolvedEntry["card"] | undefined }> {
  return entries.map((entry) => {
    const card = repo.peek(entry.cardId);
    return { entry, card };
  });
}

function CardChip({
  cardId,
  name,
  manaCost,
  subtitle,
  draggableId,
  disabled,
  isCarrying,
  onPickUp,
}: {
  cardId: CardId;
  name: string;
  manaCost: string | undefined;
  subtitle: string;
  draggableId: string;
  disabled: boolean;
  isCarrying: boolean;
  onPickUp: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    disabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      data-testid={`plan-card-${cardId}`}
      data-card-id={cardId}
      data-card-name={name}
      disabled={disabled}
      style={style}
      {...attributes}
      {...listeners}
      aria-pressed={isCarrying}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onPickUp();
        }
      }}
      className={`border-border bg-background flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
        isDragging ? "opacity-30" : ""
      } ${isCarrying ? "ring-accent ring-2" : ""}`}
    >
      <span className="truncate">{name}</span>
      <span className="flex items-center gap-2">
        {manaCost !== undefined ? (
          <span className="text-muted-foreground text-xs">{manaCost}</span>
        ) : null}
        <span className="text-muted-foreground text-xs" data-testid="plan-card-subtitle">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

function Zone({
  id,
  testId,
  title,
  isValidTarget,
  isDraggingAny,
  children,
}: {
  id: ZoneId;
  testId: string;
  title: string;
  isValidTarget: boolean;
  isDraggingAny: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const highlight = isDraggingAny
    ? isValidTarget
      ? isOver
        ? "border-green-500 bg-green-500/10"
        : "border-green-500/60"
      : isOver
        ? "border-red-500 bg-red-500/10"
        : "border-border"
    : "border-border";

  return (
    <section
      ref={setNodeRef}
      data-testid={testId}
      data-zone={id}
      aria-label={title}
      className={`min-h-32 space-y-1.5 rounded-md border-2 p-2 transition-colors ${highlight}`}
    >
      <h4 className="text-foreground text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

export function DragPlanner({ matchupId, variant, deck, plan }: DragPlannerProps) {
  const store = useWorkspaceStoreApi();
  const repo = useCardRepository();
  const reducedMotion = usePrefersReducedMotion();
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);
  const [carrying, setCarrying] = useState<{ zone: ZoneId; cardId: CardId; name: string } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const maindeckRows = useMemo(
    () => buildSourceRows(deck, "maindeck", plan, repo),
    [deck, plan, repo],
  );
  const sideboardRows = useMemo(
    () => buildSourceRows(deck, "sideboard", plan, repo),
    [deck, plan, repo],
  );
  const outRows = useMemo(() => planEntryRows(plan.out, deck, repo), [deck, plan, repo]);
  const inRows = useMemo(() => planEntryRows(plan.in, deck, repo), [deck, plan, repo]);

  const ctx: PlanContext = { deck };

  const applyMove = (origin: ZoneId, target: ZoneId, cardId: CardId): boolean => {
    if (VALID_TARGET[origin] !== target) return false;

    store.getState().editPlan(matchupId, variant, (p) => {
      if (origin === "maindeck-source") return addOut(p, ctx, cardId);
      if (origin === "sideboard-source") return addIn(p, ctx, cardId);
      if (origin === "out-zone") {
        const current = p.out.find((e) => e.cardId === cardId)?.quantity ?? 0;
        return setOutQuantity(p, ctx, cardId, current - 1);
      }
      // origin === "in-zone"
      const current = p.in.find((e) => e.cardId === cardId)?.quantity ?? 0;
      return setInQuantity(p, ctx, cardId, current - 1);
    });
    return true;
  };

  const totalsAfter = (): { out: number; in: number } => {
    const state = store.getState();
    const matchup = state.workspace.matchups.find((m) => m.id === matchupId);
    const nextPlan = matchup?.plans[variant] ?? { out: [], in: [] };
    return {
      out: nextPlan.out.reduce((s, e) => s + e.quantity, 0),
      in: nextPlan.in.reduce((s, e) => s + e.quantity, 0),
    };
  };

  const onDragStart = (event: DragStartEvent) => {
    const [zone] = String(event.active.id).split(":") as [ZoneId, string];
    setActiveZone(zone);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveZone(null);
    const [origin, cardId] = String(event.active.id).split(":") as [ZoneId, CardId];
    const target = event.over?.id as ZoneId | undefined;
    if (target === undefined) return;
    applyMove(origin, target, cardId);
  };

  // --- Keyboard drag path (D-5) ---
  const cardName = (cardId: CardId): string => repo.peek(cardId)?.name ?? cardId;

  const pickUp = (zone: ZoneId, cardId: CardId) => {
    const name = cardName(cardId);
    setCarrying({ zone, cardId, name });
    setActiveZone(zone);
    setAnnouncement(`Picked up ${name}`);
  };

  const cancelCarry = () => {
    if (carrying === null) return;
    setAnnouncement(`Cancelled — ${carrying.name} was not moved`);
    setCarrying(null);
    setActiveZone(null);
  };

  const moveCarry = (key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => {
    if (carrying === null || activeZone === null) return;
    const next = ZONE_GRID[activeZone]?.[key];
    if (next === undefined) return;
    setActiveZone(next);
    setAnnouncement(`Over ${ZONE_LABEL[next]} zone`);
  };

  const dropCarry = () => {
    if (carrying === null || activeZone === null) return;
    const { zone: origin, cardId, name } = carrying;
    const moved = applyMove(origin, activeZone, cardId);
    if (moved) {
      const totals = totalsAfter();
      setAnnouncement(
        `Dropped ${name} into ${ZONE_LABEL[activeZone]}. ${totals.out} out, ${totals.in} in.`,
      );
    } else {
      setAnnouncement(`${ZONE_LABEL[activeZone]} does not accept ${name}. Nothing changed.`);
    }
    setCarrying(null);
    setActiveZone(null);
  };

  const onContainerKeyDown = (event: KeyboardEvent) => {
    if (carrying === null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelCarry();
    } else if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      event.preventDefault();
      moveCarry(event.key);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      dropCarry();
    }
  };

  const activeDraggedCard = useMemo(() => {
    if (carrying !== null) return { name: carrying.name };
    return null;
  }, [carrying]);

  return (
    <div data-testid="drag-planner" onKeyDown={onContainerKeyDown}>
      <div
        aria-live="polite"
        role="status"
        className="sr-only"
        data-testid="drag-planner-announcer"
      >
        {announcement}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-3 md:grid-cols-2">
          <Zone
            id="maindeck-source"
            testId="plan-maindeck-source"
            title="Maindeck"
            isValidTarget={activeZone !== null && VALID_TARGET["out-zone"] === "maindeck-source"}
            isDraggingAny={activeZone !== null}
          >
            {maindeckRows.map((row) => (
              <CardChip
                key={row.entry.cardId}
                cardId={row.entry.cardId}
                name={row.entry.card.name}
                manaCost={row.entry.card.manaCost}
                subtitle={`${row.availability.remaining} left`}
                draggableId={`maindeck-source:${row.entry.cardId}`}
                disabled={!row.availability.canAdd}
                isCarrying={
                  carrying?.zone === "maindeck-source" && carrying.cardId === row.entry.cardId
                }
                onPickUp={() => pickUp("maindeck-source", row.entry.cardId)}
              />
            ))}
          </Zone>

          <Zone
            id="out-zone"
            testId="plan-out-zone"
            title="OUT"
            isValidTarget={activeZone === "maindeck-source"}
            isDraggingAny={activeZone !== null}
          >
            {outRows.map(({ entry, card }) => (
              <div key={entry.cardId} className="flex items-center gap-1">
                <div className="flex-1">
                  <CardChip
                    cardId={entry.cardId}
                    name={card?.name ?? entry.cardId}
                    manaCost={card?.manaCost}
                    subtitle={`${entry.quantity}×`}
                    draggableId={`out-zone:${entry.cardId}`}
                    disabled={false}
                    isCarrying={carrying?.zone === "out-zone" && carrying.cardId === entry.cardId}
                    onPickUp={() => pickUp("out-zone", entry.cardId)}
                  />
                </div>
                <NoteField
                  value={entry.note ?? ""}
                  onChange={(note) =>
                    store
                      .getState()
                      .editPlan(matchupId, variant, (p) =>
                        setEntryNote(p, "out", entry.cardId, note),
                      )
                  }
                  label={`Note for ${card?.name ?? entry.cardId}`}
                />
                <button
                  type="button"
                  data-testid="plan-card-remove"
                  aria-label={`Remove one ${card?.name ?? entry.cardId} from OUT`}
                  className="text-muted-foreground hover:text-foreground px-1 text-xs"
                  onClick={() =>
                    store
                      .getState()
                      .editPlan(matchupId, variant, (p) =>
                        setOutQuantity(p, ctx, entry.cardId, entry.quantity - 1),
                      )
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </Zone>

          <Zone
            id="sideboard-source"
            testId="plan-sideboard-source"
            title="Sideboard"
            isValidTarget={activeZone === "in-zone"}
            isDraggingAny={activeZone !== null}
          >
            {sideboardRows.map((row) => (
              <CardChip
                key={row.entry.cardId}
                cardId={row.entry.cardId}
                name={row.entry.card.name}
                manaCost={row.entry.card.manaCost}
                subtitle={`${row.availability.remaining} left`}
                draggableId={`sideboard-source:${row.entry.cardId}`}
                disabled={!row.availability.canAdd}
                isCarrying={
                  carrying?.zone === "sideboard-source" && carrying.cardId === row.entry.cardId
                }
                onPickUp={() => pickUp("sideboard-source", row.entry.cardId)}
              />
            ))}
          </Zone>

          <Zone
            id="in-zone"
            testId="plan-in-zone"
            title="IN"
            isValidTarget={activeZone === "sideboard-source"}
            isDraggingAny={activeZone !== null}
          >
            {inRows.map(({ entry, card }) => (
              <div key={entry.cardId} className="flex items-center gap-1">
                <div className="flex-1">
                  <CardChip
                    cardId={entry.cardId}
                    name={card?.name ?? entry.cardId}
                    manaCost={card?.manaCost}
                    subtitle={`${entry.quantity}×`}
                    draggableId={`in-zone:${entry.cardId}`}
                    disabled={false}
                    isCarrying={carrying?.zone === "in-zone" && carrying.cardId === entry.cardId}
                    onPickUp={() => pickUp("in-zone", entry.cardId)}
                  />
                </div>
                <NoteField
                  value={entry.note ?? ""}
                  onChange={(note) =>
                    store
                      .getState()
                      .editPlan(matchupId, variant, (p) =>
                        setEntryNote(p, "in", entry.cardId, note),
                      )
                  }
                  label={`Note for ${card?.name ?? entry.cardId}`}
                />
                <button
                  type="button"
                  data-testid="plan-card-remove"
                  aria-label={`Remove one ${card?.name ?? entry.cardId} from IN`}
                  className="text-muted-foreground hover:text-foreground px-1 text-xs"
                  onClick={() =>
                    store
                      .getState()
                      .editPlan(matchupId, variant, (p) =>
                        setInQuantity(p, ctx, entry.cardId, entry.quantity - 1),
                      )
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </Zone>
        </div>

        <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
          {activeDraggedCard !== null ? (
            <div className="border-accent bg-background rounded-md border-2 px-2 py-1.5 text-sm shadow-lg">
              {activeDraggedCard.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function NoteField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (note: string) => void;
  label: string;
}) {
  return (
    <input
      type="text"
      data-testid="plan-entry-note"
      aria-label={label}
      placeholder="Note"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border-border bg-background w-20 rounded border px-1 py-0.5 text-xs"
    />
  );
}
