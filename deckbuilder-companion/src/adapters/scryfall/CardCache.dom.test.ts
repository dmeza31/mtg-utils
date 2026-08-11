/**
 * SPEC-A Task A-7 — the two-tier (memory + localStorage) card cache
 * (FR-2.5, FR-2.6). jsdom project per SPEC-A, though tests inject a fake
 * `Storage` rather than the ambient `localStorage` global: on this Node
 * version, Node's own experimental `localStorage` global shadows jsdom's
 * and is non-functional without `--localstorage-file` (see the deviation
 * recorded in SPEC-A's Definition of Done). `CardCache`'s constructor
 * already takes an injectable `storage` — using it here avoids depending on
 * a platform quirk instead of the class under test. The real browser
 * `localStorage` that production code falls back to is trusted framework
 * behaviour, not something to re-prove in a test.
 */
import { describe, expect, it } from "vitest";
import type { Card, CardId } from "../../domain/model/types";
import { CardCache } from "./CardCache";

function aCard(overrides: Partial<Card> = {}): Card {
  return {
    oracleId: "oracle-1" as CardId,
    name: "Lightning Bolt",
    manaValue: 1,
    typeLine: "Instant",
    colors: ["R"],
    colorIdentity: ["R"],
    rarity: "common",
    set: "lea",
    collectorNumber: "161",
    layout: "normal",
    cachedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createFakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("CardCache", () => {
  it("returns a warm entry from memory without touching storage again", () => {
    const cache = new CardCache({ storage: createFakeStorage() });
    const card = aCard();
    cache.set(card);
    expect(cache.get(card.oracleId)).toEqual(card);
  });

  it("returns undefined for a cold cache", () => {
    const cache = new CardCache({ storage: createFakeStorage() });
    expect(cache.get("nope" as CardId)).toBeUndefined();
  });

  it("persists to localStorage and is readable by a second cache instance (FR-2.5)", () => {
    const storage = createFakeStorage();
    const card = aCard();
    new CardCache({ storage }).set(card);

    const second = new CardCache({ storage });
    expect(second.get(card.oracleId)).toEqual(card);
  });

  it("namespaces and versions its localStorage keys", () => {
    const storage = createFakeStorage();
    const card = aCard();
    new CardCache({ storage }).set(card);
    expect(storage.getItem(`dbc:cards:v1:${card.oracleId}`)).not.toBeNull();
  });

  it("treats an entry older than the 7-day TTL as expired", () => {
    let time = Date.parse("2026-01-08T00:00:00.000Z");
    const now = () => time;
    const cache = new CardCache({ storage: createFakeStorage(), now });

    const card = aCard({ cachedAt: "2026-01-01T00:00:00.000Z" });
    cache.set(card);

    time = Date.parse("2026-01-08T00:00:00.001Z"); // exactly 7 days + 1ms later
    expect(cache.get(card.oracleId)).toBeUndefined();
  });

  it("still returns an entry just under the 7-day TTL", () => {
    let time = Date.parse("2026-01-01T00:00:00.000Z");
    const now = () => time;
    const cache = new CardCache({ storage: createFakeStorage(), now });

    const card = aCard({ cachedAt: "2026-01-01T00:00:00.000Z" });
    cache.set(card);

    time = Date.parse("2026-01-07T23:59:59.999Z");
    expect(cache.get(card.oracleId)).toEqual(card);
  });

  it("discards corrupt localStorage JSON instead of throwing (NFR-4.4)", () => {
    const storage = createFakeStorage();
    storage.setItem("dbc:cards:v1:broken", "{not valid json");
    const cache = new CardCache({ storage });
    expect(() => cache.get("broken" as CardId)).not.toThrow();
    expect(cache.get("broken" as CardId)).toBeUndefined();
  });

  it("degrades to memory-only when localStorage throws QuotaExceededError", () => {
    const fakeStorage: Storage = {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      },
    };
    const cache = new CardCache({ storage: fakeStorage });
    const card = aCard();

    expect(() => cache.set(card)).not.toThrow();
    expect(cache.get(card.oracleId)).toEqual(card);
  });
});
