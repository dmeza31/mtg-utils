/**
 * SPEC-A Task A-7 — two-tier card cache (FR-2.5, FR-2.6): an in-memory `Map`
 * for the session, backed by `localStorage` for persistence across sessions.
 * Keyed by oracle id, namespaced and versioned so a future schema change can
 * invalidate cleanly without a migration.
 */
import type { Card, CardId } from "../../domain/model/types";

const CACHE_KEY_PREFIX = "dbc:cards:v1:";
// FR-2.5 — at least 7 days.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CardCacheOptions {
  readonly storage?: Storage | undefined;
  readonly now?: () => number;
}

function storageKey(cardId: CardId): string {
  return `${CACHE_KEY_PREFIX}${cardId}`;
}

/**
 * Some Node versions expose a non-functional global `localStorage` stub
 * (Node's experimental webstorage without `--localstorage-file`) even
 * outside a browser or jsdom. Falling back to it would throw on first
 * `setItem` instead of degrading gracefully, so it's only trusted when it
 * actually looks like a working `Storage`.
 */
function detectAmbientLocalStorage(): Storage | undefined {
  if (typeof localStorage === "undefined") return undefined;
  if (typeof localStorage.setItem !== "function" || typeof localStorage.getItem !== "function") {
    return undefined;
  }
  return localStorage;
}

export class CardCache {
  private readonly memory = new Map<CardId, Card>();
  private readonly storage: Storage | undefined;
  private readonly now: () => number;

  constructor(options: CardCacheOptions = {}) {
    this.storage = "storage" in options ? options.storage : detectAmbientLocalStorage();
    this.now = options.now ?? Date.now;
  }

  get(cardId: CardId): Card | undefined {
    const fromMemory = this.memory.get(cardId);
    if (fromMemory !== undefined) {
      if (!this.isExpired(fromMemory)) return fromMemory;
      this.memory.delete(cardId);
    }

    const fromStorage = this.readFromStorage(cardId);
    if (fromStorage === undefined) return undefined;

    this.memory.set(cardId, fromStorage);
    return fromStorage;
  }

  set(card: Card): void {
    this.memory.set(card.oracleId, card);
    this.writeToStorage(card);
  }

  private readFromStorage(cardId: CardId): Card | undefined {
    if (this.storage === undefined) return undefined;
    const key = storageKey(cardId);
    const raw = this.storage.getItem(key);
    if (raw === null) return undefined;

    let card: Card;
    try {
      card = JSON.parse(raw) as Card;
    } catch {
      // NFR-4.4 — corrupt JSON is discarded, never thrown on.
      this.storage.removeItem(key);
      return undefined;
    }

    if (this.isExpired(card)) {
      this.storage.removeItem(key);
      return undefined;
    }
    return card;
  }

  private isExpired(card: Card): boolean {
    const cachedAtMs = Date.parse(card.cachedAt);
    if (Number.isNaN(cachedAtMs)) return true;
    return this.now() - cachedAtMs >= TTL_MS;
  }

  private writeToStorage(card: Card): void {
    if (this.storage === undefined) return;
    try {
      this.storage.setItem(storageKey(card.oracleId), JSON.stringify(card));
    } catch {
      // A QuotaExceededError (or any other storage write failure) degrades
      // to memory-only. A crash here would be an absurd way to lose a
      // session over a cache write.
    }
  }
}
