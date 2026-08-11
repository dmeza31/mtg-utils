"use client";

/**
 * SPEC-B — the deck view (SPEC-A Task A-10 built the import screen; this
 * adds the deck view below it once a deck exists).
 *
 * `ImportScreen` always renders, never hidden behind a toggle: SPEC-A's own
 * story tests (A1/A3/A4) re-import over an existing deck by interacting
 * with the textarea and confirm button directly, with no extra step to
 * "reveal" the import screen first. A collapsible/tabbed layout is a
 * reasonable future refinement once SPEC-C adds real page navigation, but
 * changing this now would break contracts SPEC-A already established.
 *
 * `DeckView` sits outside the `max-w-2xl` intro column so its responsive
 * grid (2 to 8 columns, FR-3.9/NFR-3.2) can use the root layout's full
 * `max-w-7xl` width instead of being capped to intro-text-reading width.
 *
 * SPEC-C adds the matchup sidebar + detail below the deck view, once a deck
 * exists — matchups technically don't require a deck (SPEC-C §2), but the
 * product flow described in the story specs is import → view deck → plan
 * matchups, so the section follows that order.
 */
import { DeckView } from "@/features/deck/DeckView";
import { ImportScreen } from "@/features/import/ImportScreen";
import { MatchupDetail } from "@/features/matchup/MatchupDetail";
import { MatchupSidebar } from "@/features/matchup/MatchupSidebar";
import { useWorkspaceState } from "@/state/WorkspaceProvider";

export default function Home() {
  const deck = useWorkspaceState((s) => s.workspace.deck);

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {deck?.name ?? "Deckbuilder Companion"}
          </h1>
          {deck === undefined ? (
            <p className="text-muted-foreground">
              Import an MTGO decklist, build a sideboard plan for every matchup you expect to face,
              and export the lot as a document you can carry to the tournament.
            </p>
          ) : null}
        </div>
        <ImportScreen />
      </div>

      {deck !== undefined ? (
        <>
          <DeckView />
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <MatchupSidebar />
            <MatchupDetail />
          </div>
        </>
      ) : null}
    </div>
  );
}
