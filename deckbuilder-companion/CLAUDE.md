@AGENTS.md

# Deckbuilder Companion

Import an MTGO decklist, build a sideboard plan per matchup, export it for the tournament.

## Read this first

| What                | Where                                           |
| ------------------- | ----------------------------------------------- |
| **What** to build   | `docs/requirements/requirements.md`             |
| **How** to build it | `docs/specs/` — start at `docs/specs/README.md` |
| Current progress    | SPEC-000–002, SPEC-A done. SPEC-B or SPEC-C next. |

Specs are written to be opened cold. To start a session:

> Read `docs/specs/SPEC-00X-*.md` and implement task N.

## The one rule that matters

**`src/domain/**` imports nothing from React, Next, the DOM, or any network client.**

This is enforced by `boundaries/dependencies` in `eslint.config.mjs`, and the
enforcement itself is verified by `pnpm lint:purity` in CI. It is what keeps the
domain unit-testable in milliseconds and what makes the future server migration
additive rather than a rewrite.

Layer direction (arrows are "may import"):

```
app ──▶ features ──▶ state ──▶ adapters ──▶ domain
 └──▶ components ──▶ components         domain ──▶ domain (only)
```

Note `features` may **not** import `adapters` directly — adapter access goes
through `state`, so swapping the client-side Scryfall client for a server proxy
touches one layer.

## TDD cycle

Every task in every spec follows red → green → refactor. Write the failing test
first and watch it fail for the _right_ reason (assertion, not import error).
Outside-in for features: start with the Playwright story test, let it drive you
inward to domain unit tests, then wire the UI until it goes green.

Full details in `docs/specs/SPEC-001-testing-strategy.md`.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm lint:purity    # assert the domain purity rule actually fires
pnpm format         # prettier --write
```

```bash
pnpm test:unit      # vitest — unit + dom projects, with coverage
pnpm test:e2e       # playwright — story specs + smoke/infra specs
pnpm test:contract  # vitest — LIVE Scryfall API, nightly-only, never on PRs
pnpm fixtures:refresh  # regenerate tests/fixtures/scryfall/** from live Scryfall
pnpm check:stories     # fails until every user story has an E2E spec (expected red until M3)
```

## Conventions

- Unit tests colocated: `src/domain/parser/parseDecklist.test.ts`
- E2E tests: `tests/e2e/<STORY>-<slug>.spec.ts`, one file per user story
- Test selectors: `data-testid="<feature>-<element>"`
- Test names cite the requirement: `it('rejects boarding in more copies than the sideboard holds (FR-6.4)')`
- Never `any`, never `@ts-expect-error`, never a committed `.only`
- `docs/` is Prettier-ignored — the specs are authored documents, don't reflow them
