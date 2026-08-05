# Deckbuilder Companion

A deck building companion for Magic: The Gathering. Paste an MTGO decklist, see the deck laid out
with card art, build a sideboard plan for every matchup you expect to face, and export the lot as a
document you can print or read on your phone between rounds.

v1 is a client-side web app. Nothing is sent to a server and nothing is stored beyond your own
browser.

## Status

Under construction. SPEC-000 (project setup) is complete; features begin at SPEC-A.

## Getting started

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000.

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
