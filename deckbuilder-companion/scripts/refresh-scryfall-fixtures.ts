/**
 * SPEC-001 Task 3/6 — regenerates tests/fixtures/scryfall/** from the live
 * Scryfall API. Run deliberately (`pnpm fixtures:refresh`), review the diff,
 * commit it. Tests never hit the network themselves; this script is the one
 * place that does, and only on purpose.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "tests/fixtures/scryfall",
);

// FR-2.4 — every Scryfall request carries a descriptive User-Agent and asks
// for JSON explicitly.
const HEADERS = {
  "User-Agent": "deckbuilder-companion-fixture-refresh/1.0 (+https://github.com/dmeza/mtg-utils)",
  Accept: "application/json",
  "Content-Type": "application/json",
};

// FR-2.3 — no more than 10 req/s, ~100ms minimum between calls.
const REQUEST_DELAY_MS = 120;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeFixture(name: string, value: unknown) {
  const file = path.join(FIXTURES_DIR, name);
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, headers: HEADERS });
  const body = await response.json();
  await sleep(REQUEST_DELAY_MS);
  return body;
}

// The card pool referenced across tests/fixtures/decklists/*.txt. Kept as one
// list so the collection fixture and the decklists never drift apart.
const COLLECTION_NAMES = [
  "Lightning Bolt",
  "Monastery Swiftspear",
  "Goblin Guide",
  "Eidolon of the Great Revel",
  "Dragon's Rage Channeler",
  "Ledger Shredder",
  "Murktide Regent",
  "Unholy Heat",
  "Expressive Iteration",
  "Consider",
  "Counterspell",
  "Mishra's Bauble",
  // The collection endpoint resolves split cards by front-face name only —
  // "Fire // Ice" (the combined form FR-1.7.4 also accepts) comes back
  // not_found. Learned by hitting the live API while building this fixture.
  "Fire",
  "Delver of Secrets",
  "Bonecrusher Giant",
  "Lim-Dûl's Vault",
  "Æther Vial",
  "Nazgûl",
  "Path to Exile",
  "Mountain",
  "Island",
  "Steam Vents",
];

async function refreshCollection() {
  const body = await fetchJson("https://api.scryfall.com/cards/collection", {
    method: "POST",
    body: JSON.stringify({ identifiers: COLLECTION_NAMES.map((name) => ({ name })) }),
  });
  await writeFixture("collection-modern-staples.json", body);

  const withUnresolved = await fetchJson("https://api.scryfall.com/cards/collection", {
    method: "POST",
    body: JSON.stringify({
      identifiers: [
        { name: "Lightning Bolt" },
        { name: "Lightnin Bolt" },
        { name: "Not A Real Card Xyzzy" },
      ],
    }),
  });
  await writeFixture("collection-not-found.json", withUnresolved);
}

async function refreshSearchPrints() {
  const targets = [
    { card: "Lightning Bolt", file: "search-prints-lightning-bolt.json" },
    { card: "Dragon's Rage Channeler", file: "search-prints-dragons-rage-channeler.json" },
    { card: "Fire // Ice", file: "search-prints-fire-ice.json" },
  ];
  for (const { card, file } of targets) {
    const q = encodeURIComponent(`!"${card}"`);
    const body = await fetchJson(
      `https://api.scryfall.com/cards/search?q=${q}&unique=prints&order=released&dir=asc`,
    );
    await writeFixture(file, body);
  }
}

async function refreshNamedFuzzy() {
  const corrected = await fetchJson("https://api.scryfall.com/cards/named?fuzzy=Lightnin%20Bolt");
  await writeFixture("named-fuzzy-lightning-bolt.json", corrected);

  const unresolvable = await fetchJson("https://api.scryfall.com/cards/named?fuzzy=Xyzzyplorp");
  await writeFixture("named-fuzzy-unresolvable.json", unresolvable);
}

async function main() {
  await mkdir(FIXTURES_DIR, { recursive: true });
  await refreshCollection();
  await refreshSearchPrints();
  await refreshNamedFuzzy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
