/**
 * Placeholder home page.
 *
 * SPEC-000 builds the ground, not the features. The real import screen lands in
 * SPEC-A (Task A-10); this exists so the layout, theming and attribution are
 * verifiable now.
 */
export default function Home() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Deckbuilder Companion
      </h1>
      <p className="text-muted-foreground">
        Import an MTGO decklist, build a sideboard plan for every matchup you expect to face, and
        export the lot as a document you can carry to the tournament.
      </p>
      <p className="border-border text-muted-foreground rounded-md border border-dashed px-4 py-3 text-sm">
        Deck import arrives in SPEC-A.
      </p>
    </div>
  );
}
