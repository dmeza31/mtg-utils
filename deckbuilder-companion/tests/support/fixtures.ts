/**
 * SPEC-001 Task 4 — the Playwright-layer Scryfall mock. Resolution logic is
 * shared with the MSW handlers via `scryfallFixtureData.ts`; this file only
 * adds the route-interception plumbing and the failure-injection controls
 * specs A and B need (`fail`, `rateLimit`, `delay`, `offline`,
 * `requestCount`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { test as base, type Page, type Route } from "@playwright/test";
import { resolveCollection, resolveNamed, resolveSearch } from "./scryfallFixtureData";

// cwd-relative — see the comment in scryfallFixtureData.ts for why this
// isn't `import.meta.url`.
const PLACEHOLDER_IMAGE = readFileSync(
  path.join(process.cwd(), "tests/fixtures/images/card-placeholder.png"),
);

export type ScryfallEndpoint = "collection" | "search" | "named";

type OverrideMode = "fail" | "rateLimit";

export class ScryfallMock {
  private readonly overrides = new Map<ScryfallEndpoint, OverrideMode>();
  private readonly counts = new Map<ScryfallEndpoint, number>();
  private delayMs = 0;
  private isOffline = false;

  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    await this.page.route("https://api.scryfall.com/cards/collection", (route) =>
      this.handleApi(route, "collection"),
    );
    await this.page.route("https://api.scryfall.com/cards/search**", (route) =>
      this.handleApi(route, "search"),
    );
    await this.page.route("https://api.scryfall.com/cards/named**", (route) =>
      this.handleApi(route, "named"),
    );
    await this.page.route("https://cards.scryfall.io/**", (route) => this.handleImage(route));
  }

  /** Force a 500 on the next requests — FR-2.11, NFR-4.2. Omit `endpoint` to fail everything. */
  fail(endpoint?: ScryfallEndpoint): void {
    this.setOverride(endpoint, "fail");
  }

  /** Force a 429 on the next requests — FR-2.3, FR-2.11. Omit `endpoint` to rate-limit everything. */
  rateLimit(endpoint?: ScryfallEndpoint): void {
    this.setOverride(endpoint, "rateLimit");
  }

  /** Slow every subsequent response by `ms` — for asserting loading states. */
  delay(ms: number): void {
    this.delayMs = ms;
  }

  /** Abort every Scryfall route (API and images) — FR-10.12, NFR-4.1. */
  offline(): void {
    this.isOffline = true;
  }

  /** Restore normal responses and timing. */
  reset(): void {
    this.overrides.clear();
    this.delayMs = 0;
    this.isOffline = false;
  }

  /**
   * Requests seen by an endpoint since `install()`. The only way FR-2.6 ("a
   * cache hit SHALL NOT produce a network request") is testable.
   */
  requestCount(endpoint: ScryfallEndpoint): number {
    return this.counts.get(endpoint) ?? 0;
  }

  private setOverride(endpoint: ScryfallEndpoint | undefined, mode: OverrideMode): void {
    const endpoints: readonly ScryfallEndpoint[] = endpoint
      ? [endpoint]
      : ["collection", "search", "named"];
    for (const e of endpoints) this.overrides.set(e, mode);
  }

  private async handleApi(route: Route, endpoint: ScryfallEndpoint): Promise<void> {
    this.counts.set(endpoint, (this.counts.get(endpoint) ?? 0) + 1);

    if (this.isOffline) {
      await route.abort("internetdisconnected");
      return;
    }
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    const override = this.overrides.get(endpoint);
    if (override === "fail") {
      await this.fulfillError(route, 500, "server_error", "mocked failure");
      return;
    }
    if (override === "rateLimit") {
      await this.fulfillError(route, 429, "rate_limited", "mocked rate limit");
      return;
    }

    const request = route.request();
    const result =
      endpoint === "collection"
        ? {
            status: 200,
            body: resolveCollection(
              (request.postDataJSON() as { identifiers: Array<{ name?: string }> }).identifiers,
            ),
          }
        : endpoint === "search"
          ? resolveSearch(new URL(request.url()).searchParams.get("q") ?? "")
          : resolveNamed({
              exact: new URL(request.url()).searchParams.get("exact"),
              fuzzy: new URL(request.url()).searchParams.get("fuzzy"),
            });

    await route.fulfill({
      status: result.status,
      contentType: "application/json",
      body: JSON.stringify(result.body),
    });
  }

  private async handleImage(route: Route): Promise<void> {
    if (this.isOffline) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({ status: 200, contentType: "image/png", body: PLACEHOLDER_IMAGE });
  }

  private async fulfillError(
    route: Route,
    status: number,
    code: string,
    details: string,
  ): Promise<void> {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ object: "error", code, status, details }),
    });
  }
}

export const test = base.extend<{ scryfall: ScryfallMock }>({
  scryfall: async ({ page }, use) => {
    const mock = new ScryfallMock(page);
    await mock.install();
    // Playwright's fixture-teardown callback, conventionally named `use` —
    // not React 19's `use()` hook. eslint-plugin-react-hooks can't tell them
    // apart by name alone.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(mock);
  },
});

export { expect } from "@playwright/test";
