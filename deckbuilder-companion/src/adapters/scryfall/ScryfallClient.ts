/**
 * SPEC-A Task A-6 — raw Scryfall HTTP client. No caching, no domain types:
 * this is the one place that talks to the network, and `CardCache`
 * (task A-7) / `ScryfallCardRepository` (task A-8) are the only callers.
 */
import type { z } from "zod";
import {
  CollectionResponseSchema,
  ScryfallCardSchema,
  SearchResponseSchema,
  type CollectionResponse,
  type ScryfallCard,
} from "./schemas";

export interface ScryfallIdentifier {
  readonly name: string;
}

/** FR-2.11 — a request that never succeeded after retrying. Never an opaque throw. */
export class ScryfallRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "ScryfallRequestError";
  }
}

/** NFR-6.6 — a 2xx response that doesn't match the shape we depend on. */
export class ScryfallResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScryfallResponseValidationError";
  }
}

// FR-2.2 — Scryfall's documented cap, guarded by the contract test
// (tests/contract/scryfall.test.ts).
const MAX_COLLECTION_IDENTIFIERS = 75;
// FR-2.3 — no more than 10 req/s, at least 100ms between requests.
const MIN_REQUEST_GAP_MS = 100;
// FR-2.11 — retry budget for 429 / 5xx before reporting failure.
const MAX_ATTEMPTS = 4;
const BACKOFF_BASE_MS = 200;
// FR-2.4
const USER_AGENT = "deckbuilder-companion/1.0 (+https://github.com/dmeza/mtg-utils)";
// FR-2.15 — chunk search queries by encoded URL length, not name count.
// Conservative default, comfortably under common proxy/browser URL caps.
const DEFAULT_SEARCH_QUERY_URL_BUDGET = 1900;

export interface ScryfallClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  readonly baseUrl?: string;
  readonly searchQueryUrlBudget?: number;
}

interface RawResponse {
  readonly status: number;
  readonly json: unknown;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toSearchTerm(names: readonly string[]): string {
  const clauses = names.map((name) => `!"${name}"`).join(" or ");
  return `(${clauses}) game:paper`;
}

function buildSearchPath(names: readonly string[]): string {
  const q = encodeURIComponent(toSearchTerm(names));
  return `/cards/search?q=${q}&unique=prints&order=released&dir=asc`;
}

/** FR-2.15 — groups names so each group's search URL stays under budget. */
function buildSearchGroups(
  names: readonly string[],
  baseUrl: string,
  urlBudget: number,
): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];

  for (const name of names) {
    const candidate = [...current, name];
    const url = `${baseUrl}${buildSearchPath(candidate)}`;
    if (url.length > urlBudget && current.length > 0) {
      groups.push(current);
      current = [name];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class ScryfallClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly baseUrl: string;
  private readonly searchQueryUrlBudget: number;

  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private throttleQueue: Promise<void> = Promise.resolve();

  constructor(options: ScryfallClientOptions = {}) {
    // Bound explicitly: browsers' native `fetch` throws "Illegal invocation"
    // when called without `window` as the receiver, which `this.fetchImpl(...)`
    // does. Node's fetch doesn't enforce this, so it's invisible in tests
    // that never call through an unbound property access.
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.baseUrl = options.baseUrl ?? "https://api.scryfall.com";
    this.searchQueryUrlBudget = options.searchQueryUrlBudget ?? DEFAULT_SEARCH_QUERY_URL_BUDGET;
  }

  async collection(identifiers: readonly ScryfallIdentifier[]): Promise<CollectionResponse> {
    const chunks = chunk(identifiers, MAX_COLLECTION_IDENTIFIERS);
    const responses = await Promise.all(chunks.map((c) => this.collectionChunk(c)));
    return responses.reduce<CollectionResponse>(
      (acc, r) => ({
        object: "list",
        not_found: [...acc.not_found, ...r.not_found],
        data: [...acc.data, ...r.data],
      }),
      { object: "list", not_found: [], data: [] },
    );
  }

  private async collectionChunk(
    identifiers: readonly ScryfallIdentifier[],
  ): Promise<CollectionResponse> {
    const { status, json } = await this.requestWithRetry(
      "POST",
      "/cards/collection",
      JSON.stringify({ identifiers }),
    );
    if (status !== 200) {
      throw new ScryfallRequestError(`Unexpected /cards/collection status ${status}`, status, 1);
    }
    return this.validate(CollectionResponseSchema, json, "collection");
  }

  async searchPrints(names: readonly string[]): Promise<readonly ScryfallCard[]> {
    if (names.length === 0) return [];
    const groups = buildSearchGroups(names, this.baseUrl, this.searchQueryUrlBudget);
    const cards: ScryfallCard[] = [];
    for (const group of groups) {
      cards.push(...(await this.searchAllPages(buildSearchPath(group))));
    }
    return cards;
  }

  private async searchAllPages(firstPath: string): Promise<ScryfallCard[]> {
    const cards: ScryfallCard[] = [];
    let path: string | undefined = firstPath;

    while (path !== undefined) {
      const { status, json } = await this.requestWithRetry("GET", path);
      if (status === 404) break; // no printings matched — not an error
      if (status !== 200) {
        throw new ScryfallRequestError(`Unexpected /cards/search status ${status}`, status, 1);
      }
      const page = this.validate(SearchResponseSchema, json, "search");
      cards.push(...page.data);
      path =
        page.has_more && page.next_page !== undefined
          ? page.next_page.replace(this.baseUrl, "")
          : undefined;
    }
    return cards;
  }

  async namedFuzzy(name: string): Promise<ScryfallCard | undefined> {
    const { status, json } = await this.requestWithRetry(
      "GET",
      `/cards/named?fuzzy=${encodeURIComponent(name)}`,
    );
    if (status === 404) return undefined;
    if (status !== 200) {
      throw new ScryfallRequestError(`Unexpected /cards/named status ${status}`, status, 1);
    }
    return this.validate(ScryfallCardSchema, json, "named");
  }

  private validate<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ScryfallResponseValidationError(
        `Invalid ${context} response from Scryfall: ${result.error.message}`,
      );
    }
    return result.data;
  }

  private async requestWithRetry(
    method: "GET" | "POST",
    path: string,
    body?: string,
  ): Promise<RawResponse> {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      const response = await this.requestOnce(method, path, body);
      if (!isRetryableStatus(response.status)) return response;
      if (attempt >= MAX_ATTEMPTS) {
        throw new ScryfallRequestError(
          `Scryfall request to ${path} failed after ${attempt} attempts (status ${response.status})`,
          response.status,
          attempt,
        );
      }
      await this.sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1) * (1 + this.random()));
    }
  }

  private async requestOnce(
    method: "GET" | "POST",
    path: string,
    body?: string,
  ): Promise<RawResponse> {
    await this.throttle();
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body } : {}),
    });
    const json: unknown = await response.json().catch(() => undefined);
    return { status: response.status, json };
  }

  /** FR-2.3 — serializes requests so concurrent callers still respect the min gap. */
  private async throttle(): Promise<void> {
    const previous = this.throttleQueue;
    let release: () => void = () => {};
    this.throttleQueue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;

    const wait = MIN_REQUEST_GAP_MS - (this.now() - this.lastRequestAt);
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();
    release();
  }
}
