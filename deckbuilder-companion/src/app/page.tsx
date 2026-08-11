/**
 * SPEC-A Task A-10 — the home page is the import screen. Deck display
 * (SPEC-B) and matchup management (SPEC-C) replace this placeholder-free
 * page incrementally; for now, importing is the only thing there is to do.
 */
import { ImportScreen } from "@/features/import/ImportScreen";

export default function Home() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Deckbuilder Companion
        </h1>
        <p className="text-muted-foreground">
          Import an MTGO decklist, build a sideboard plan for every matchup you expect to face, and
          export the lot as a document you can carry to the tournament.
        </p>
      </div>
      <ImportScreen />
    </div>
  );
}
