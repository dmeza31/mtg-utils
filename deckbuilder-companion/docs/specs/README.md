# Deckbuilder Companion — Implementation Specs

This folder contains the implementation plan for v1, broken into specs that can be picked up independently across multiple sessions.

**Source of truth for *what* to build:** [`../requirements/requirements.md`](../requirements/requirements.md)
**Source of truth for *how* to build it:** these specs.

---

## How to use these specs

Each spec is written to be opened **cold**, with no prior conversation context. It restates what it needs from the requirements, names exact file paths and function signatures, and gives an ordered TDD task list.

To start a session:

> Read `docs/specs/SPEC-00X-*.md` and implement task N. Follow the TDD cycle defined in SPEC-001.

**Every task in every spec follows red → green → refactor.** The task lists are written so that the first line of every task is the test you write before any production code exists.

---

## Spec index

| Spec | Title | Covers | Depends on |
|---|---|---|---|
| [SPEC-000](SPEC-000-project-setup.md) | Project Setup & Tooling | Scaffold, TypeScript, lint, CI | — |
| [SPEC-001](SPEC-001-testing-strategy.md) | Testing Strategy & TDD Workflow | Vitest, Playwright, fixtures, Scryfall mocking, a11y | 000 |
| [SPEC-002](SPEC-002-domain-core.md) | Domain Core | Domain model, ports, state store | 000, 001 |
| [SPEC-A](SPEC-A-deck-import.md) | Epic A — Import a Deck | A1–A4, FR-1, FR-2, FR-4 | 002 |
| [SPEC-B](SPEC-B-deck-display.md) | Epic B — See the Deck | B1–B4, FR-3 | A |
| [SPEC-C](SPEC-C-matchup-management.md) | Epic C — Manage Matchups | C1–C4, FR-5 | 002 |
| [SPEC-D](SPEC-D-sideboard-planning.md) | Epic D — Build a Sideboard Plan | D1–D7, FR-6, FR-7, FR-8, FR-9 | B, C |
| [SPEC-E](SPEC-E-export-and-portability.md) | Epic E — Export and Carry | E1–E4, FR-10, FR-11 | D |

---

## Build sequence

```
SPEC-000 ─▶ SPEC-001 ─▶ SPEC-002 ─┬─▶ SPEC-A ─▶ SPEC-B ─┐
                                  │                     ├─▶ SPEC-D ─▶ SPEC-E
                                  └─▶ SPEC-C ───────────┘
```

SPEC-C has no dependency on A or B beyond the domain core, so it can be built in parallel with A/B if you want a second workstream. Everything else is strictly sequential.

### Suggested milestones

| Milestone | Specs | Demonstrable outcome |
|---|---|---|
| **M0 — Walking skeleton** | 000, 001, 002 | App boots, CI is green, domain types exist, one E2E smoke test passes. |
| **M1 — Deck is visible** | A, B | Paste a real Modern list → see 75 cards with oldest-print art. |
| **M2 — Plans exist** | C, D | Add five matchups and build a validated sideboard plan for each, in both UI modes. |
| **M3 — Shippable v1** | E | Export the binder as MD and PDF; reload work after a refresh. |

---

## Conventions used across all specs

### Requirement traceability

Every task references the requirement IDs it satisfies (`FR-6.3`, `NFR-2.2`). Every test file header comment names the story and requirement IDs it covers. Nothing gets built that isn't traceable to a requirement, and no `M`-priority requirement ships without a test.

### File layout

```
deckbuilder-companion/
├── src/
│   ├── app/                    # Next.js App Router — routes and layouts only
│   ├── features/               # Feature-scoped UI: import/, deck/, matchup/, plan/, export/
│   ├── components/ui/          # Generic presentational primitives
│   ├── domain/                 # PURE TypeScript. No React, no DOM, no fetch.
│   │   ├── model/              # Types and constructors
│   │   ├── parser/             # Decklist parsing
│   │   ├── deck/               # Grouping, sorting, stats, deck validation
│   │   ├── plan/               # Plan actions, validation, post-board deck
│   │   ├── printing/           # Oldest-print selection policy
│   │   ├── export/             # Binder view model + Markdown generator
│   │   └── ports/              # Interfaces the domain depends on (CardRepository)
│   ├── adapters/               # Port implementations: scryfall/, storage/
│   └── state/                  # Zustand store wiring domain actions to UI
├── tests/
│   ├── e2e/                    # Playwright, one spec file per user story
│   ├── component/              # Playwright CT for drag-and-drop
│   ├── fixtures/               # Shared by unit and E2E — single source of truth
│   └── support/                # Test helpers, mock server, fixture loaders
└── docs/
```

### The domain purity rule

`src/domain/**` may not import from React, Next.js, the DOM, or any network client. This is enforced in CI (SPEC-000, task 6). It is the single most important structural rule in the project: it is what makes TDD fast, and it is what makes the v2 server migration additive rather than a rewrite (requirements §10.3).

### Naming

| Thing | Convention | Example |
|---|---|---|
| Unit test file | `<module>.test.ts`, colocated | `src/domain/parser/parseDecklist.test.ts` |
| E2E test file | `tests/e2e/<STORY>-<slug>.spec.ts` | `tests/e2e/A1-paste-decklist.spec.ts` |
| Test selector | `data-testid="<feature>-<element>"` | `data-testid="plan-out-zone"` |
| Fixture decklist | `tests/fixtures/decklists/<variant>.txt` | `tests/fixtures/decklists/mtgo-blankline.txt` |

### Definition of Done (applies to every task)

1. A failing test existed before the production code.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` all pass.
3. Requirement IDs are referenced in the test file header.
4. No `any`, no `@ts-expect-error`, no `.only` left in tests.
5. For UI tasks: keyboard-operable and passes the axe check (NFR-2).
