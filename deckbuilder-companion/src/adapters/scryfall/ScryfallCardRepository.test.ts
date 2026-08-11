/**
 * SPEC-A Task A-8 — ScryfallCardRepository composing ScryfallClient +
 * CardCache + the printing policy, against MSW (default fixtures +
 * `server.use` overrides for batching-count and failure scenarios).
 */
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../tests/support/setup-unit";
import { toCardId } from "../../domain/model/types";
import { CardCache } from "./CardCache";
import { ScryfallCardRepository } from "./ScryfallCardRepository";
import { ScryfallClient } from "./ScryfallClient";

// Every distinct name available in tests/fixtures/scryfall/collection-modern-staples.json.
const KNOWN_NAMES = [
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
  "Delver of Secrets",
  "Bonecrusher Giant",
  "Lim-Dûl's Vault",
  "Aether Vial",
  "Nazgûl",
  "Path to Exile",
  "Mountain",
  "Island",
  "Steam Vents",
  "Fire // Ice",
];

function makeRepository(): ScryfallCardRepository {
  const client = new ScryfallClient({ sleep: async () => {} });
  const cache = new CardCache({ storage: undefined });
  return new ScryfallCardRepository(client, cache);
}

let collectionRequestCount = 0;
let searchRequestCount = 0;

server.events.on("request:start", ({ request }) => {
  if (request.url.includes("/cards/collection")) collectionRequestCount += 1;
  if (request.url.includes("/cards/search")) searchRequestCount += 1;
});

beforeEach(() => {
  collectionRequestCount = 0;
  searchRequestCount = 0;
});

describe("ScryfallCardRepository.resolve", () => {
  it("resolves every known name in exactly one collection request and one search request (FR-2.2, FR-2.15)", async () => {
    const repository = makeRepository();
    const result = await repository.resolve(KNOWN_NAMES.map((name) => ({ name })));

    expect(result.unresolved).toEqual([]);
    expect(result.cards.size).toBe(KNOWN_NAMES.length);
    expect(collectionRequestCount).toBe(1);
    expect(searchRequestCount).toBe(1);
  });

  it("selects Lightning Bolt's oldest paper printing (LEA) — D-6", async () => {
    const repository = makeRepository();
    const result = await repository.resolve([{ name: "Lightning Bolt" }]);
    const boltId = result.byQueriedName.get("Lightning Bolt");
    const bolt = boltId !== undefined ? result.cards.get(boltId) : undefined;

    expect(bolt?.set).toBe("lea");
    expect(bolt?.collectorNumber).toBe("161");
    expect(bolt?.printingFallback).toBeUndefined();
  });

  it("a second resolve of the same names makes zero network requests (FR-2.6)", async () => {
    const repository = makeRepository();
    await repository.resolve(KNOWN_NAMES.map((name) => ({ name })));

    collectionRequestCount = 0;
    searchRequestCount = 0;
    await repository.resolve(KNOWN_NAMES.map((name) => ({ name })));

    expect(collectionRequestCount).toBe(0);
    expect(searchRequestCount).toBe(0);
  });

  it("one unresolvable name is reported without blocking the rest (FR-2.10)", async () => {
    const repository = makeRepository();
    const names = ["Lightning Bolt", "Lightnin Bolt", "Monastery Swiftspear"];
    const result = await repository.resolve(names.map((name) => ({ name })));

    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]).toMatchObject({
      name: "Lightnin Bolt",
      suggestion: "Lightning Bolt",
    });
    expect(result.byQueriedName.get("Lightning Bolt")).toBeDefined();
    expect(result.byQueriedName.get("Monastery Swiftspear")).toBeDefined();
  });

  it("falls back to identity art when phase 2 (search) fails entirely (FR-2.16)", async () => {
    server.use(
      http.get("https://api.scryfall.com/cards/search", () =>
        HttpResponse.json({ object: "error", code: "service_unavailable" }, { status: 503 }),
      ),
    );

    const repository = makeRepository();
    const result = await repository.resolve([{ name: "Lightning Bolt" }]);
    const boltId = result.byQueriedName.get("Lightning Bolt");
    const bolt = boltId !== undefined ? result.cards.get(boltId) : undefined;

    expect(bolt).toBeDefined();
    expect(bolt?.printingFallback).toBe(true);
  });

  it("a DFC resolves with both faces populated (FR-2.9)", async () => {
    const repository = makeRepository();
    const result = await repository.resolve([{ name: "Delver of Secrets" }]);
    const id = result.byQueriedName.get("Delver of Secrets");
    const card = id !== undefined ? result.cards.get(id) : undefined;

    expect(card?.faces).toHaveLength(2);
    expect(card?.faces?.map((f) => f.name)).toEqual(["Delver of Secrets", "Insectile Aberration"]);
  });

  it("resolves a split card whether queried by front face or full name (FR-1.7.4)", async () => {
    const repository = makeRepository();
    const result = await repository.resolve([{ name: "Fire" }, { name: "Fire // Ice" }]);

    const idFromFront = result.byQueriedName.get("Fire");
    const idFromFull = result.byQueriedName.get("Fire // Ice");
    expect(idFromFront).toBeDefined();
    expect(idFromFront).toBe(idFromFull);
    expect(result.cards.size).toBe(1);
  });

  it("selects the oldest printing even when a newer one is first in the response (D-6)", async () => {
    server.use(
      http.get("https://api.scryfall.com/cards/search", () =>
        HttpResponse.json({
          object: "list",
          has_more: false,
          data: [
            {
              object: "card",
              id: "newer-print",
              oracle_id: "4457ed35-7c10-48c8-9776-456485fdf070",
              name: "Lightning Bolt",
              cmc: 1,
              type_line: "Instant",
              color_identity: ["R"],
              rarity: "common",
              set: "abc",
              set_type: "expansion",
              collector_number: "5",
              layout: "normal",
              released_at: "2020-01-01",
              games: ["paper"],
              digital: false,
              image_uris: { normal: "https://example.com/newer.jpg" },
            },
            {
              object: "card",
              id: "oldest-print",
              oracle_id: "4457ed35-7c10-48c8-9776-456485fdf070",
              name: "Lightning Bolt",
              cmc: 1,
              type_line: "Instant",
              color_identity: ["R"],
              rarity: "common",
              set: "lea",
              set_type: "core",
              collector_number: "161",
              layout: "normal",
              released_at: "1993-08-05",
              games: ["paper"],
              digital: false,
              image_uris: { normal: "https://example.com/oldest.jpg" },
            },
          ],
        }),
      ),
    );

    const repository = makeRepository();
    const result = await repository.resolve([{ name: "Lightning Bolt" }]);
    const id = result.byQueriedName.get("Lightning Bolt");
    const card = id !== undefined ? result.cards.get(id) : undefined;

    expect(card?.set).toBe("lea");
    expect(card?.collectorNumber).toBe("161");
  });
});

describe("ScryfallCardRepository.peek / suggest", () => {
  it("peek is cache-only and answers nothing before resolve", () => {
    const repository = makeRepository();
    expect(repository.peek(toCardId("nonexistent"))).toBeUndefined();
  });

  it("suggest returns a fuzzy match", async () => {
    const repository = makeRepository();
    expect(await repository.suggest("Lightnin Bolt")).toBe("Lightning Bolt");
  });

  it("suggest returns undefined instead of throwing for a nonsense name", async () => {
    const repository = makeRepository();
    await expect(repository.suggest("Xyzzyplorp Nonsense")).resolves.toBeUndefined();
  });
});
