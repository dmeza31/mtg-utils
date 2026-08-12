"use client";

/**
 * SPEC-E Task E-7 (FR-11.4, R-1). Wraps the app: on mount, checks for a
 * saved workspace and *offers* to restore it — never applies it silently,
 * since silently restoring stale work when the user came to start fresh is
 * its own kind of data loss.
 */
import type { ReactNode } from "react";
import { useAutosaveRestore } from "@/state/useAutosaveRestore";

export function AutosaveGate({ children }: { children: ReactNode }) {
  const { pending, accept, decline } = useAutosaveRestore();
  const hasOffer = pending !== undefined;

  return (
    <>
      {hasOffer ? (
        <div
          data-testid="restore-banner"
          role="status"
          className="border-border bg-muted/40 border-b"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
            <p className="text-foreground">
              We found saved work from your last session. Restore it?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="restore-accept"
                className="border-border bg-background rounded-md border px-3 py-1.5 font-medium"
                onClick={accept}
              >
                Restore
              </button>
              <button
                type="button"
                data-testid="restore-decline"
                className="text-muted-foreground px-3 py-1.5 underline underline-offset-2"
                onClick={decline}
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
