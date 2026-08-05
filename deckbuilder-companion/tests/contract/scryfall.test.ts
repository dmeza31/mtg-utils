/**
 * SPEC-001 Task 6 — Scryfall contract tests. These hit the LIVE API and run
 * nightly only (see .github/workflows/ci.yml), never on PRs.
 *
 * The mocked suite tests our code against our *belief* about the Scryfall
 * API, frozen into tests/fixtures/scryfall/**. This file tests the belief
 * itself: it asserts the shape we depend on, not any particular card's data.
 * When it fails, the fix is `pnpm fixtures:refresh` and a review of the diff
 * — not a change here.
 */
import { describe, expect, it } from "vitest";

const HEADERS = {
  "User-Agent": "deckbuilder-companion-contract-test/1.0",
  Accept: "application/json",
  "Content-Type": "application/json",
};

interface ScryfallCard {
  object: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  rarity: string;
  set: string;
  collector_number: string;
  image_uris?: Record<string, string>;
  layout: string;
  card_faces?: Array<Record<string, unknown>>;
  released_at: string;
}

async function scryfallFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.scryfall.com${path}`, { ...init, headers: HEADERS });
}

describe("POST /cards/collection (FR-2.2, FR-2.15)", () => {
  it("accepts an identifiers array and returns data + not_found", async () => {
    const response = await scryfallFetch("/cards/collection", {
      method: "POST",
      body: JSON.stringify({
        identifiers: [{ name: "Lightning Bolt" }, { name: "Not A Real Card Xyzzy" }],
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      object: string;
      data: ScryfallCard[];
      not_found: unknown[];
    };
    expect(body.object).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
    expect(Array.isArray(body.not_found)).toBe(true);
    expect(body.data.some((c) => c.name === "Lightning Bolt")).toBe(true);
    expect(body.not_found).toHaveLength(1);
  });

  it("still caps identifiers at 75 per request", async () => {
    const tooMany = Array.from({ length: 76 }, () => ({ name: "Mountain" }));
    const response = await scryfallFetch("/cards/collection", {
      method: "POST",
      body: JSON.stringify({ identifiers: tooMany }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { details: string };
    expect(body.details).toContain("75");

    const exactly75 = Array.from({ length: 75 }, () => ({ name: "Mountain" }));
    const okResponse = await scryfallFetch("/cards/collection", {
      method: "POST",
      body: JSON.stringify({ identifiers: exactly75 }),
    });
    expect(okResponse.status).toBe(200);
  });
});

describe("GET /cards/search (FR-2.13, FR-2.14, FR-2.15)", () => {
  it("unique=prints, order=released, dir=asc returns data, has_more, next_page", async () => {
    const q = encodeURIComponent('!"Lightning Bolt"');
    const response = await scryfallFetch(
      `/cards/search?q=${q}&unique=prints&order=released&dir=asc`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      object: string;
      data: ScryfallCard[];
      has_more: boolean;
      total_cards: number;
    };
    expect(body.object).toBe("list");
    expect("has_more" in body).toBe(true);
    expect(body.data.length).toBeGreaterThan(1);
  });

  it("oldest-print ordering still yields Alpha as Lightning Bolt's oldest paper printing (D-6)", async () => {
    const q = encodeURIComponent('!"Lightning Bolt"');
    const response = await scryfallFetch(
      `/cards/search?q=${q}&unique=prints&order=released&dir=asc`,
    );
    const body = (await response.json()) as { data: ScryfallCard[] };
    expect(body.data[0]?.set).toBe("lea");
    expect(body.data[0]?.released_at).toBe("1993-08-05");
  });
});

describe("card shape — FR-2.12 required fields", () => {
  it("a single-faced card exposes every FR-2.12 field", async () => {
    const response = await scryfallFetch("/cards/named?exact=Lightning%20Bolt");
    const card = (await response.json()) as ScryfallCard;
    expect(card.name).toBe("Lightning Bolt");
    expect(typeof card.mana_cost).toBe("string");
    expect(typeof card.cmc).toBe("number");
    expect(typeof card.type_line).toBe("string");
    expect(typeof card.oracle_text).toBe("string");
    expect(Array.isArray(card.colors)).toBe(true);
    expect(Array.isArray(card.color_identity)).toBe(true);
    expect(typeof card.rarity).toBe("string");
    expect(typeof card.set).toBe("string");
    expect(typeof card.collector_number).toBe("string");
    expect(card.image_uris).toBeDefined();
    expect(typeof card.layout).toBe("string");
  });

  it("a double-faced card exposes card_faces (FR-2.9, FR-2.12)", async () => {
    const response = await scryfallFetch("/cards/named?exact=Delver%20of%20Secrets");
    const card = (await response.json()) as ScryfallCard;
    expect(card.layout).toBe("transform");
    expect(Array.isArray(card.card_faces)).toBe(true);
    expect(card.card_faces).toHaveLength(2);
  });
});
