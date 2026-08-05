/**
 * SPEC-001 Task 4 — verifies the Playwright `ScryfallMock` actually does what
 * its DoD claims (fail / rateLimit / delay / offline / requestCount) before
 * spec A and B are written to depend on it. Not tied to a user story.
 *
 * Requests go through `fetch()` from the page so they're subject to the same
 * CSP as real app code (`connect-src 'self' https://api.scryfall.com`,
 * SPEC-000 Task 5) — a route that only worked outside the page wouldn't
 * prove anything about the real app.
 */
import { expect, test } from "../support/fixtures";

async function fetchJson(page: import("@playwright/test").Page, url: string, init?: RequestInit) {
  return page.evaluate(
    async ([u, i]) => {
      const res = await fetch(u as string, i as RequestInit | undefined);
      return { status: res.status, body: await res.json() };
    },
    [url, init] as const,
  );
}

test("collection endpoint resolves known cards from the fixture", async ({ page, scryfall }) => {
  await page.goto("/");
  const { status, body } = await fetchJson(page, "https://api.scryfall.com/cards/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifiers: [{ name: "Lightning Bolt" }, { name: "Not A Real Card" }],
    }),
  });
  expect(status).toBe(200);
  expect((body as { data: Array<{ name: string }> }).data.map((c) => c.name)).toContain(
    "Lightning Bolt",
  );
  expect((body as { not_found: Array<{ name: string }> }).not_found).toEqual([
    { name: "Not A Real Card" },
  ]);
  expect(scryfall.requestCount("collection")).toBe(1);
});

test("search endpoint returns oldest-print-first fixture data", async ({ page }) => {
  await page.goto("/");
  const { status, body } = await fetchJson(
    page,
    'https://api.scryfall.com/cards/search?q=!"Lightning Bolt"&unique=prints&order=released&dir=asc',
  );
  expect(status).toBe(200);
  const cards = (body as { data: Array<{ released_at: string }> }).data;
  expect(cards.length).toBeGreaterThan(1);
  expect(new Date(cards[0]!.released_at).getTime()).toBeLessThan(
    new Date(cards[1]!.released_at).getTime(),
  );
});

test("named fuzzy endpoint corrects a misspelled name", async ({ page }) => {
  await page.goto("/");
  const { status, body } = await fetchJson(
    page,
    "https://api.scryfall.com/cards/named?fuzzy=Lightnin%20Bolt",
  );
  expect(status).toBe(200);
  expect((body as { name: string }).name).toBe("Lightning Bolt");
});

test("named fuzzy endpoint 404s on an unresolvable name (FR-2.10)", async ({ page }) => {
  await page.goto("/");
  const { status, body } = await fetchJson(
    page,
    "https://api.scryfall.com/cards/named?fuzzy=Xyzzyplorp",
  );
  expect(status).toBe(404);
  expect((body as { object: string }).object).toBe("error");
});

test("mock.fail forces a 500 on the targeted endpoint only", async ({ page, scryfall }) => {
  scryfall.fail("collection");
  await page.goto("/");
  const collection = await fetchJson(page, "https://api.scryfall.com/cards/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifiers: [{ name: "Lightning Bolt" }] }),
  });
  expect(collection.status).toBe(500);

  const named = await fetchJson(
    page,
    "https://api.scryfall.com/cards/named?exact=Lightning%20Bolt",
  );
  expect(named.status).toBe(200);
});

test("mock.rateLimit forces a 429", async ({ page, scryfall }) => {
  scryfall.rateLimit();
  await page.goto("/");
  const { status } = await fetchJson(
    page,
    "https://api.scryfall.com/cards/named?exact=Lightning%20Bolt",
  );
  expect(status).toBe(429);
});

test("mock.delay slows the response", async ({ page, scryfall }) => {
  scryfall.delay(300);
  await page.goto("/");
  const start = Date.now();
  await fetchJson(page, "https://api.scryfall.com/cards/named?exact=Lightning%20Bolt");
  expect(Date.now() - start).toBeGreaterThanOrEqual(300);
});

test("mock.offline aborts API and image requests (FR-10.12, NFR-4.1)", async ({
  page,
  scryfall,
}) => {
  scryfall.offline();
  await page.goto("/");
  await expect(
    page.evaluate(() => fetch("https://api.scryfall.com/cards/named?exact=Lightning%20Bolt")),
  ).rejects.toThrow();

  const imageLoaded = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const img = document.createElement("img");
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = "https://cards.scryfall.io/normal/front/0/0/00000000.jpg";
        document.body.appendChild(img);
      }),
  );
  expect(imageLoaded).toBe(false);
});

test("requestCount tracks each endpoint independently", async ({ page, scryfall }) => {
  await page.goto("/");
  await fetchJson(page, "https://api.scryfall.com/cards/named?exact=Lightning%20Bolt");
  await fetchJson(page, "https://api.scryfall.com/cards/named?exact=Lightning%20Bolt");
  await fetchJson(
    page,
    'https://api.scryfall.com/cards/search?q=!"Lightning Bolt"&unique=prints&order=released&dir=asc',
  );
  expect(scryfall.requestCount("named")).toBe(2);
  expect(scryfall.requestCount("search")).toBe(1);
  expect(scryfall.requestCount("collection")).toBe(0);
});
