/**
 * SPEC-001 Task 4 — MSW handlers for the unit-test layer. Resolution logic
 * lives in `scryfallFixtureData.ts`, shared verbatim with the Playwright
 * `ScryfallMock` in `fixtures.ts` — the two mock layers read the same
 * fixture files through the same code, so they can't drift apart.
 */
import { http, HttpResponse, type JsonBodyType } from "msw";
import { resolveCollection, resolveNamed, resolveSearch } from "./scryfallFixtureData";

export const scryfallHandlers = [
  http.post("https://api.scryfall.com/cards/collection", async ({ request }) => {
    const body = (await request.json()) as { identifiers: Array<{ name?: string }> };
    return HttpResponse.json(resolveCollection(body.identifiers) as JsonBodyType);
  }),

  http.get("https://api.scryfall.com/cards/search", ({ request }) => {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const { status, body } = resolveSearch(q);
    return HttpResponse.json(body as JsonBodyType, { status });
  }),

  http.get("https://api.scryfall.com/cards/named", ({ request }) => {
    const url = new URL(request.url);
    const { status, body } = resolveNamed({
      exact: url.searchParams.get("exact"),
      fuzzy: url.searchParams.get("fuzzy"),
    });
    return HttpResponse.json(body as JsonBodyType, { status });
  }),
];
