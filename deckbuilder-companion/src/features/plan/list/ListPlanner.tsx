"use client";

/**
 * SPEC-D Task D-6 (FR-9.1–9.5) — list mode: two panels of compact stepper
 * rows. Reads the same `plan` the drag mode reads and calls the same
 * SPEC-002 `actions.ts` functions (§2's architectural rule) — there is no
 * list-mode-local plan state here, only search/filter UI state.
 */
import { useMemo, useState, type KeyboardEvent } from "react";
import { cardType, type CardType } from "@/domain/deck/group";
import { resolveEntries, type ResolvedEntry } from "@/domain/deck/queries";
import {
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
  PlanVariant,
  SideboardPlan,
  Zone,
} from "@/domain/model/types";
import { useCardRepository, useWorkspaceStoreApi } from "@/state/WorkspaceProvider";

export interface ListPlannerProps {
  readonly matchupId: MatchupId;
  readonly variant: PlanVariant;
  readonly deck: Deck;
  readonly plan: SideboardPlan;
}

interface Row {
  readonly entry: ResolvedEntry;
  readonly availability: CardAvailability;
  readonly note: string;
}

const TYPE_FILTER_OPTIONS: ReadonlyArray<{ value: CardType | "all"; label: string }> = [
  { value: "all", label: "All types" },
  { value: "Creature", label: "Creatures" },
  { value: "Planeswalker", label: "Planeswalkers" },
  { value: "Instant", label: "Instants" },
  { value: "Sorcery", label: "Sorceries" },
  { value: "Artifact", label: "Artifacts" },
  { value: "Enchantment", label: "Enchantments" },
  { value: "Battle", label: "Battles" },
  { value: "Land", label: "Lands" },
  { value: "Other", label: "Other" },
];

function buildRows(
  deck: Deck,
  zone: Zone,
  plan: SideboardPlan,
  repo: Parameters<typeof resolveEntries>[2],
): readonly Row[] {
  const entries = resolveEntries(deck, zone, repo);
  const availability =
    zone === "maindeck" ? maindeckAvailability(deck, plan) : sideboardAvailability(deck, plan);
  const planEntries = zone === "maindeck" ? plan.out : plan.in;
  const byCardId = new Map(availability.map((a) => [a.cardId, a]));
  const notesByCardId = new Map(planEntries.map((e) => [e.cardId, e.note ?? ""]));
  return entries.flatMap((entry): Row[] => {
    const a = byCardId.get(entry.cardId);
    if (a === undefined) return [];
    return [{ entry, availability: a, note: notesByCardId.get(entry.cardId) ?? "" }];
  });
}

function sortRows(rows: readonly Row[]): readonly Row[] {
  return [...rows].sort((a, b) => {
    const aPlanned = a.availability.planned > 0 ? 0 : 1;
    const bPlanned = b.availability.planned > 0 ? 0 : 1;
    if (aPlanned !== bPlanned) return aPlanned - bPlanned;
    return a.entry.card.name.localeCompare(b.entry.card.name);
  });
}

function filterRows(
  rows: readonly Row[],
  search: string,
  typeFilter: CardType | "all",
): readonly Row[] {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (query !== "" && !row.entry.card.name.toLowerCase().includes(query)) return false;
    if (typeFilter !== "all" && cardType(row.entry.card) !== typeFilter) return false;
    return true;
  });
}

function StepperRow({
  row,
  side,
  onChange,
  onNoteChange,
}: {
  row: Row;
  side: "out" | "in";
  onChange: (cardId: CardId, quantity: number) => void;
  onNoteChange: (cardId: CardId, note: string) => void;
}) {
  const { entry, availability } = row;
  const { card, cardId } = entry;
  const max = availability.remaining + availability.planned;
  const isPlanned = availability.planned > 0;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "+") {
      event.preventDefault();
      if (availability.canAdd) onChange(cardId, availability.planned + 1);
    } else if (event.key === "ArrowLeft" || event.key === "-") {
      event.preventDefault();
      if (availability.canRemove) onChange(cardId, availability.planned - 1);
    }
  };

  return (
    <div
      data-testid="plan-list-row"
      data-card-id={cardId}
      data-card-name={card.name}
      data-planned={isPlanned}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`border-border flex items-center justify-between gap-2 border-b px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isPlanned ? "bg-accent/10" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground w-6 text-right text-xs">{availability.inDeck}×</span>
        <span className="truncate font-medium">{card.name}</span>
        {card.manaCost !== undefined ? (
          <span className="text-muted-foreground text-xs">{card.manaCost}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="plan-list-decrement"
          aria-label={`Board ${side === "out" ? "in fewer" : "in less of"} ${card.name}`}
          disabled={!availability.canRemove}
          className="border-border flex h-6 w-6 items-center justify-center rounded border text-xs disabled:opacity-30"
          onClick={() => onChange(cardId, availability.planned - 1)}
        >
          −
        </button>
        <input
          type="number"
          data-testid="plan-list-stepper-value"
          aria-label={`${card.name} quantity`}
          min={0}
          max={max}
          value={availability.planned}
          onChange={(event) => {
            const raw = Number(event.target.value);
            const clamped = Math.max(0, Math.min(Number.isNaN(raw) ? 0 : raw, max));
            onChange(cardId, clamped);
          }}
          className="border-border bg-background w-10 rounded border px-1 py-0.5 text-center text-xs"
        />
        <button
          type="button"
          data-testid="plan-list-increment"
          aria-label={`Board ${side === "out" ? "out" : "in"} ${card.name}`}
          disabled={!availability.canAdd}
          className="border-border flex h-6 w-6 items-center justify-center rounded border text-xs disabled:opacity-30"
          onClick={() => onChange(cardId, availability.planned + 1)}
        >
          +
        </button>
        {isPlanned ? (
          <input
            type="text"
            data-testid="plan-entry-note"
            aria-label={`Note for ${card.name}`}
            placeholder="Note"
            value={row.note}
            onChange={(event) => onNoteChange(cardId, event.target.value)}
            className="border-border bg-background w-20 rounded border px-1 py-0.5 text-xs"
          />
        ) : null}
      </div>
    </div>
  );
}

function Panel({
  title,
  rows,
  side,
  onChange,
  onNoteChange,
  testId,
}: {
  title: string;
  rows: readonly Row[];
  side: "out" | "in";
  onChange: (cardId: CardId, quantity: number) => void;
  onNoteChange: (cardId: CardId, note: string) => void;
  testId: string;
}) {
  return (
    <section data-testid={testId} aria-label={title}>
      <h4 className="text-foreground mb-2 text-sm font-semibold">{title}</h4>
      <div className="border-border divide-border rounded-md border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">No cards match.</p>
        ) : (
          rows.map((row) => (
            <StepperRow
              key={row.entry.cardId}
              row={row}
              side={side}
              onChange={onChange}
              onNoteChange={onNoteChange}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function ListPlanner({ matchupId, variant, deck, plan }: ListPlannerProps) {
  const store = useWorkspaceStoreApi();
  const repo = useCardRepository();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CardType | "all">("all");

  const maindeckRows = useMemo(
    () => sortRows(filterRows(buildRows(deck, "maindeck", plan, repo), search, typeFilter)),
    [deck, plan, repo, search, typeFilter],
  );
  const sideboardRows = useMemo(
    () => sortRows(filterRows(buildRows(deck, "sideboard", plan, repo), search, typeFilter)),
    [deck, plan, repo, search, typeFilter],
  );

  const setOut = (cardId: CardId, quantity: number) => {
    store
      .getState()
      .editPlan(matchupId, variant, (p, ctx: PlanContext) =>
        setOutQuantity(p, ctx, cardId, quantity),
      );
  };
  const setIn = (cardId: CardId, quantity: number) => {
    store
      .getState()
      .editPlan(matchupId, variant, (p, ctx: PlanContext) =>
        setInQuantity(p, ctx, cardId, quantity),
      );
  };
  const setOutNote = (cardId: CardId, note: string) => {
    store.getState().editPlan(matchupId, variant, (p) => setEntryNote(p, "out", cardId, note));
  };
  const setInNote = (cardId: CardId, note: string) => {
    store.getState().editPlan(matchupId, variant, (p) => setEntryNote(p, "in", cardId, note));
  };

  return (
    <div data-testid="plan-list-planner" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          data-testid="plan-list-search"
          aria-label="Search cards"
          placeholder="Search cards…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="border-border bg-background rounded-md border px-2 py-1 text-sm"
        />
        <select
          data-testid="plan-list-type-filter"
          aria-label="Filter by card type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as CardType | "all")}
          className="border-border bg-background rounded-md border px-2 py-1 text-sm"
        >
          {TYPE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          title="Maindeck"
          rows={maindeckRows}
          side="out"
          onChange={setOut}
          onNoteChange={setOutNote}
          testId="plan-list-maindeck-panel"
        />
        <Panel
          title="Sideboard"
          rows={sideboardRows}
          side="in"
          onChange={setIn}
          onNoteChange={setInNote}
          testId="plan-list-sideboard-panel"
        />
      </div>
    </div>
  );
}
