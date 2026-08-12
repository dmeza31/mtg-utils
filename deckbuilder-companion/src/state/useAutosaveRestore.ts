"use client";

/**
 * SPEC-E Task E-7 (FR-11.4, R-1). The one place `adapters/storage/autosave`
 * is used from — `features` may not import `adapters` directly (CLAUDE.md's
 * layering rule), so `AutosaveGate` (the UI) calls this hook instead of
 * touching the adapter itself.
 *
 * The debounced autosave subscription doesn't start until any pending
 * restore offer is resolved (accepted or declined): starting it earlier
 * risks the fresh, empty store overwriting the saved data before the user
 * has decided what to do with it.
 *
 * `pending` is read from `localStorage` inside an effect, not a lazy
 * `useState` initializer: this component is server-rendered first (Next
 * SSRs "use client" components for the initial HTML), where there is no
 * `localStorage` and the correct answer is "nothing to offer yet". A lazy
 * initializer runs again during client hydration and would compute the
 * *real* answer there — for a session with a saved workspace, that's a
 * real DOM mismatch (the banner exists client-side, didn't server-side),
 * not just a lint nitpick; reproduced by hand while building this hook.
 * An effect is what defers the real read until after hydration completes,
 * which is exactly what `react-hooks/set-state-in-effect` doesn't have a
 * pattern for — it's tuned for state derivable from props, and this isn't.
 */
import { useEffect, useRef, useState } from "react";
import { Autosave, clearAllLocalData, loadSavedWorkspace } from "../adapters/storage/autosave";
import type { Workspace } from "../domain/model/types";
import { useWorkspaceStoreApi } from "./WorkspaceProvider";

export type PendingRestore = Workspace | undefined;

export interface AutosaveRestore {
  readonly pending: PendingRestore;
  accept(): void;
  decline(): void;
}

export function useAutosaveRestore(): AutosaveRestore {
  const store = useWorkspaceStoreApi();
  const [pending, setPending] = useState<PendingRestore>(undefined);
  const [checked, setChecked] = useState(false);
  const autosaveRef = useRef<Autosave | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see the module doc: a client-only read that must not run during hydration has no effect-free equivalent.
    setPending(loadSavedWorkspace());
    setChecked(true);
  }, []);

  useEffect(() => {
    if (!checked || pending !== undefined) return;
    if (autosaveRef.current === null) {
      autosaveRef.current = new Autosave();
    }
    const autosave = autosaveRef.current;
    return store.subscribe((state) => {
      autosave.schedule(state.workspace);
    });
  }, [store, checked, pending]);

  return {
    pending,
    accept: () => {
      if (pending === undefined) return;
      store.getState().restoreWorkspace(pending);
      setPending(undefined);
    },
    decline: () => {
      clearAllLocalData();
      setPending(undefined);
    },
  };
}
