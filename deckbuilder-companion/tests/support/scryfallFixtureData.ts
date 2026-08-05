/**
 * SPEC-001 Task 4 — the resolution logic shared by both mock layers:
 * `scryfall-mock.ts` (MSW, unit tests) and `fixtures.ts` (Playwright route
 * interception, E2E tests). Sharing this instead of just the fixture files
 * means the two layers can't drift in *how* a query resolves, only rely on
 * the same data.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

// Resolved from the working directory (always the package root — pnpm
// scripts and CI both run from here) rather than `import.meta.url`: Vitest
// runs this file as ESM but Playwright's Node runtime transpiles test files
// to CommonJS, where `import.meta` doesn't exist. cwd-relative is the one
// path scheme both runners agree on.
const FIXTURES_DIR = path.join(process.cwd(), "tests/fixtures/scryfall");

export function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, name), "utf8")) as T;
}

export interface ScryfallCard {
  name: string;
  [key: string]: unknown;
}

export interface CollectionResponse {
  object: "list";
  not_found: Array<{ name: string }>;
  data: ScryfallCard[];
}

export interface ScryfallErrorBody {
  object: "error";
  code: string;
  status: number;
  details: string;
}

const COLLECTION_FIXTURE_FILES = ["collection-modern-staples.json", "collection-not-found.json"];

const CARDS_BY_NAME = new Map<string, ScryfallCard>();
for (const file of COLLECTION_FIXTURE_FILES) {
  const fixture = loadFixture<CollectionResponse>(file);
  for (const card of fixture.data) {
    CARDS_BY_NAME.set(card.name.toLowerCase(), card);
    // Split/DFC cards resolve by front-face name only on the real API
    // (FR-1.7.4) — see scripts/refresh-scryfall-fixtures.ts for how this was
    // discovered against live Scryfall.
    const frontFace = card.name.split(" // ")[0];
    if (frontFace) CARDS_BY_NAME.set(frontFace.toLowerCase(), card);
  }
}

const SEARCH_PRINTS_FIXTURE_BY_NAME: Record<string, string> = {
  "lightning bolt": "search-prints-lightning-bolt.json",
  "dragon's rage channeler": "search-prints-dragons-rage-channeler.json",
  fire: "search-prints-fire-ice.json",
};

const NAMED_FUZZY_FIXTURE_BY_QUERY: Record<string, string> = {
  "lightnin bolt": "named-fuzzy-lightning-bolt.json",
};

function extractQuotedName(q: string): string | undefined {
  return q.match(/!"([^"]+)"/)?.[1];
}

export function resolveCollection(identifiers: Array<{ name?: string }>): CollectionResponse {
  const data: ScryfallCard[] = [];
  const not_found: Array<{ name: string }> = [];
  for (const identifier of identifiers) {
    const card = identifier.name ? CARDS_BY_NAME.get(identifier.name.toLowerCase()) : undefined;
    if (card) data.push(card);
    else not_found.push({ name: identifier.name ?? "" });
  }
  return { object: "list", not_found, data };
}

export function resolveSearch(q: string): { status: number; body: unknown } {
  const name = extractQuotedName(q)?.toLowerCase();
  const file = name ? SEARCH_PRINTS_FIXTURE_BY_NAME[name] : undefined;
  if (!file) {
    return {
      status: 404,
      body: {
        object: "error",
        code: "not_found",
        status: 404,
        details: `No search fixture for query "${q}"`,
      } satisfies ScryfallErrorBody,
    };
  }
  return { status: 200, body: loadFixture(file) };
}

export function resolveNamed(params: { exact?: string | null; fuzzy?: string | null }): {
  status: number;
  body: unknown;
} {
  const { exact, fuzzy } = params;

  if (exact) {
    const card = CARDS_BY_NAME.get(exact.toLowerCase());
    if (card) return { status: 200, body: card };
    return {
      status: 404,
      body: {
        object: "error",
        code: "not_found",
        status: 404,
        details: `No card named "${exact}"`,
      } satisfies ScryfallErrorBody,
    };
  }

  if (fuzzy) {
    const file = NAMED_FUZZY_FIXTURE_BY_QUERY[fuzzy.toLowerCase()];
    if (file) return { status: 200, body: loadFixture(file) };
    const errorFixture = loadFixture<ScryfallErrorBody>("named-fuzzy-unresolvable.json");
    return { status: errorFixture.status, body: errorFixture };
  }

  return {
    status: 400,
    body: {
      object: "error",
      code: "bad_request",
      status: 400,
      details: "exact or fuzzy parameter required",
    } satisfies ScryfallErrorBody,
  };
}
