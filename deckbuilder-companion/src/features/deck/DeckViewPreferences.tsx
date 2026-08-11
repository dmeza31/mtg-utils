"use client";

/**
 * SPEC-B Task B-6 — group-by/sort-by/layout choice persists "in the
 * session" (FR-3.4, FR-3.5), including across navigating away from the
 * deck view and back (e.g. to a matchup, SPEC-C) and not just while
 * `DeckView` itself stays mounted. Living in a provider mounted once at
 * the root (alongside `WorkspaceProvider`) rather than as `DeckView`'s own
 * `useState` is what makes that true regardless of which feature
 * component mounts/unmounts.
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import type { GroupBy } from "@/domain/deck/group";
import type { SortBy } from "@/domain/deck/sort";
import type { DeckLayout } from "./DeckGrid";

interface DeckViewPreferencesValue {
  readonly groupBy: GroupBy;
  readonly setGroupBy: (groupBy: GroupBy) => void;
  readonly sortBy: SortBy;
  readonly setSortBy: (sortBy: SortBy) => void;
  readonly layout: DeckLayout;
  readonly setLayout: (layout: DeckLayout) => void;
}

const DeckViewPreferencesContext = createContext<DeckViewPreferencesValue | undefined>(undefined);

export function DeckViewPreferencesProvider({ children }: { children: ReactNode }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("type");
  const [sortBy, setSortBy] = useState<SortBy>("manaValue");
  const [layout, setLayout] = useState<DeckLayout>("grid");

  return (
    <DeckViewPreferencesContext.Provider
      value={{ groupBy, setGroupBy, sortBy, setSortBy, layout, setLayout }}
    >
      {children}
    </DeckViewPreferencesContext.Provider>
  );
}

export function useDeckViewPreferences(): DeckViewPreferencesValue {
  const ctx = useContext(DeckViewPreferencesContext);
  if (ctx === undefined) {
    throw new Error("useDeckViewPreferences must be used within a <DeckViewPreferencesProvider>");
  }
  return ctx;
}
