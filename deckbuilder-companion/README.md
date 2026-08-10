# Deckbuilder Companion

A deck building companion for Magic: The Gathering. Paste an MTGO decklist, see the deck laid out
with card art, build a sideboard plan for every matchup you expect to face, and export the lot as a
document you can print or read on your phone between rounds.

v1 is a client-side web app. Nothing is sent to a server and nothing is stored beyond your own
browser.

## Status

Under construction. SPEC-000 (project setup), SPEC-001 (testing strategy), and SPEC-002 (domain
core) are complete. Feature work begins at SPEC-A / SPEC-C — see
[`docs/specs/README.md`](docs/specs/README.md) for the build sequence.

## Running locally

### Prerequisites

- Node.js 22+ (matches CI — see `.github/workflows/ci.yml`)
- [pnpm](https://pnpm.io) — this repo pins `pnpm@11.1.0` via the `packageManager` field; run
  `corepack enable` once if your global `pnpm` doesn't match

### Install and run the dev server

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000. There is no server, database, or API key to configure — the app
is entirely client-side and the only outbound network call is to the public Scryfall API.

### Checks

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm lint:purity    # asserts the domain purity rule (see CLAUDE.md) actually fires
pnpm format:check   # prettier --check
pnpm build          # production build
```

### Tests

```bash
pnpm test:unit      # vitest — unit + dom projects, with coverage
```

Playwright's browser binaries aren't installed by `pnpm install`; run this once before the first
`pnpm test:e2e`:

```bash
pnpm exec playwright install --with-deps chromium firefox webkit
```

```bash
pnpm test:e2e       # playwright — runs against a production build (pnpm build && pnpm start)
```

`pnpm test:contract` (live Scryfall API) and `pnpm fixtures:refresh` are for maintaining test
fixtures — see [`docs/specs/SPEC-001-testing-strategy.md`](docs/specs/SPEC-001-testing-strategy.md)
§6. Neither is part of the normal local dev loop.

## Documentation

- [`docs/requirements/requirements.md`](docs/requirements/requirements.md) — what the product does
  and why
- [`docs/specs/`](docs/specs/README.md) — the implementation plan, one spec per epic
- [`CLAUDE.md`](CLAUDE.md) — conventions, architecture rules, and commands

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Zustand · dnd-kit · Vitest · Playwright

---

Deckbuilder Companion is unofficial Fan Content permitted under the
[Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved or
endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast.
© Wizards of the Coast LLC. Card data and images courtesy of [Scryfall](https://scryfall.com).
