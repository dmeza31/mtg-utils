/**
 * SPEC-A Task A-6 — ScryfallClient tests against MSW (tests/support/scryfall-mock.ts
 * for the happy paths, `server.use` overrides for chunking/retry/validation edge cases).
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../tests/support/setup-unit";
import {
  ScryfallClient,
  ScryfallRequestError,
  ScryfallResponseValidationError,
} from "./ScryfallClient";

function fakeClock(start = 0) {
  let time = start;
  const sleepCalls: number[] = [];
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleepCalls.push(ms);
      time += ms;
    },
    sleepCalls,
  };
}

describe("ScryfallClient.collection", () => {
  it("resolves known names against the default fixture", async () => {
    const client = new ScryfallClient({ sleep: async () => {} });
    const result = await client.collection([{ name: "Lightning Bolt" }, { name: "Not A Card" }]);
    expect(result.data.some((c) => c.name === "Lightning Bolt")).toBe(true);
    expect(result.not_found).toHaveLength(1);
  });

  it("sends exactly one request for 75 identifiers, two for 76 (FR-2.2)", async () => {
    let requestCount = 0;
    server.use(
      http.post("https://api.scryfall.com/cards/collection", () => {
        requestCount += 1;
        return HttpResponse.json({ object: "list", not_found: [], data: [] });
      }),
    );

    const client = new ScryfallClient({ sleep: async () => {} });
    const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Card ${i}` }));

    requestCount = 0;
    await client.collection(names(75));
    expect(requestCount).toBe(1);

    requestCount = 0;
    await client.collection(names(76));
    expect(requestCount).toBe(2);
  });

  it("sends the User-Agent and Accept headers on every request (FR-2.4)", async () => {
    let capturedHeaders: Headers | undefined;
    server.use(
      http.post("https://api.scryfall.com/cards/collection", ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ object: "list", not_found: [], data: [] });
      }),
    );

    const client = new ScryfallClient({ sleep: async () => {} });
    await client.collection([{ name: "Lightning Bolt" }]);

    expect(capturedHeaders?.get("user-agent")).toContain("deckbuilder-companion");
    expect(capturedHeaders?.get("accept")).toBe("application/json");
  });

  it("retries a 429 once then succeeds", async () => {
    let attempts = 0;
    server.use(
      http.post("https://api.scryfall.com/cards/collection", () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ object: "error", code: "rate_limited" }, { status: 429 });
        }
        return HttpResponse.json({ object: "list", not_found: [], data: [] });
      }),
    );

    const clock = fakeClock();
    const client = new ScryfallClient({ sleep: clock.sleep, now: clock.now });
    const result = await client.collection([{ name: "Lightning Bolt" }]);

    expect(attempts).toBe(2);
    expect(result).toEqual({ object: "list", not_found: [], data: [] });
    expect(clock.sleepCalls.length).toBeGreaterThan(0);
  });

  it("gives up after the retry budget and reports a typed failure, not a raw throw (FR-2.11)", async () => {
    server.use(
      http.post("https://api.scryfall.com/cards/collection", () =>
        HttpResponse.json({ object: "error", code: "rate_limited" }, { status: 429 }),
      ),
    );

    const clock = fakeClock();
    const client = new ScryfallClient({ sleep: clock.sleep, now: clock.now });

    await expect(client.collection([{ name: "Lightning Bolt" }])).rejects.toBeInstanceOf(
      ScryfallRequestError,
    );
  });

  it("fails Zod validation with a useful message on a malformed response (NFR-6.6)", async () => {
    server.use(
      http.post("https://api.scryfall.com/cards/collection", () =>
        HttpResponse.json({ object: "list", not_found: [], data: [{ nonsense: true }] }),
      ),
    );

    const client = new ScryfallClient({ sleep: async () => {} });
    await expect(client.collection([{ name: "Lightning Bolt" }])).rejects.toThrow(
      ScryfallResponseValidationError,
    );
    await expect(client.collection([{ name: "Lightning Bolt" }])).rejects.toThrow(
      /Invalid collection response/,
    );
  });
});

describe("ScryfallClient — rate limiting (FR-2.3)", () => {
  it("spaces consecutive requests by at least the minimum gap", async () => {
    const clock = fakeClock();
    const client = new ScryfallClient({ sleep: clock.sleep, now: clock.now });

    await client.collection([{ name: "Lightning Bolt" }]);
    await client.collection([{ name: "Lightning Bolt" }]);

    expect(clock.sleepCalls).toEqual([100]);
  });
});

describe("ScryfallClient.searchPrints", () => {
  it("returns cards from the default fixture", async () => {
    const client = new ScryfallClient({ sleep: async () => {} });
    const cards = await client.searchPrints(["Lightning Bolt"]);
    expect(cards.length).toBeGreaterThan(1);
    expect(cards[0]?.set).toBe("lea");
  });

  it("returns an empty array for a name with no matching printings", async () => {
    const client = new ScryfallClient({ sleep: async () => {} });
    const cards = await client.searchPrints(["Totally Unknown Card"]);
    expect(cards).toEqual([]);
  });

  it("splits into two requests once the encoded query exceeds the URL budget (FR-2.15)", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.scryfall.com/cards/search", () => {
        requestCount += 1;
        return HttpResponse.json({ object: "list", data: [], has_more: false });
      }),
    );

    const client = new ScryfallClient({ sleep: async () => {}, searchQueryUrlBudget: 120 });
    await client.searchPrints(["Card One", "Card Two", "Card Three"]);

    expect(requestCount).toBeGreaterThanOrEqual(2);
  });
});

describe("ScryfallClient.namedFuzzy", () => {
  it("returns the suggested card for a correctable typo", async () => {
    const client = new ScryfallClient({ sleep: async () => {} });
    const card = await client.namedFuzzy("Lightnin Bolt");
    expect(card?.name).toBe("Lightning Bolt");
  });

  it("returns undefined for an unresolvable name instead of throwing", async () => {
    const client = new ScryfallClient({ sleep: async () => {} });
    const card = await client.namedFuzzy("Xyzzyplorp Nonsense Card");
    expect(card).toBeUndefined();
  });
});
