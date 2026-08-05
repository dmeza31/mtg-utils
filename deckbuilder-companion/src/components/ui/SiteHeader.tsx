/**
 * Application header. Shows the app name and, once a deck is loaded, its name.
 *
 * Presentational only — it takes the deck name as a prop rather than reading the
 * store, so it stays inside the `components -> components` boundary (SPEC-000
 * Task 6) and stays trivially renderable in tests.
 */
export function SiteHeader({ deckName }: { deckName?: string }) {
  return (
    <header className="border-border bg-background border-b" data-testid="site-header">
      <div className="mx-auto flex max-w-7xl items-baseline gap-3 px-4 py-3 sm:px-6">
        <span className="text-foreground text-lg font-semibold tracking-tight">
          Deckbuilder Companion
        </span>
        {deckName ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
            <span className="text-muted-foreground truncate text-sm" data-testid="header-deck-name">
              {deckName}
            </span>
          </>
        ) : null}
      </div>
    </header>
  );
}
