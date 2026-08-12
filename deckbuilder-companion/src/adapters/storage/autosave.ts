/**
 * SPEC-E Task E-7 (FR-11.4, FR-11.5). R-1 from the requirements — a refresh
 * destroying an hour of sideboard planning is the single most likely
 * reason a user abandons the tool, so this is treated as `M`, not polish.
 *
 * Mirrors `CardCache`'s shape (SPEC-A Task A-7): injectable `Storage` and
 * clock/timer seams for testability, a namespaced/versioned key, and every
 * storage failure degrades to a result the caller can act on rather than
 * throwing.
 */
import { deserializeWorkspace, serializeWorkspace } from "../../domain/export/workspace";
import type { Workspace } from "../../domain/model/types";

export const STORAGE_KEY = "dbc:workspace:v1";
const CARD_CACHE_PREFIX = "dbc:cards:v1:";
const DEFAULT_DEBOUNCE_MS = 1000;

export type AutosaveWriteResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: "quota-exceeded" | "unavailable" };

/** Matches `CardCache`'s guard — an ambient non-functional `localStorage` stub must not be trusted. */
function detectAmbientLocalStorage(): Storage | undefined {
  if (typeof localStorage === "undefined") return undefined;
  if (typeof localStorage.setItem !== "function" || typeof localStorage.getItem !== "function") {
    return undefined;
  }
  return localStorage;
}

export interface AutosaveOptions {
  readonly storage?: Storage | undefined;
  readonly debounceMs?: number;
  readonly setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

export class Autosave {
  private readonly storage: Storage | undefined;
  private readonly debounceMs: number;
  private readonly setTimer: NonNullable<AutosaveOptions["setTimer"]>;
  private readonly clearTimer: NonNullable<AutosaveOptions["clearTimer"]>;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: AutosaveOptions = {}) {
    this.storage = "storage" in options ? options.storage : detectAmbientLocalStorage();
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  }

  /** Debounced write (~1s) — the last workspace scheduled within the window wins. */
  schedule(ws: Workspace): void {
    if (this.pendingTimer !== null) this.clearTimer(this.pendingTimer);
    this.pendingTimer = this.setTimer(() => {
      this.pendingTimer = null;
      this.writeNow(ws);
    }, this.debounceMs);
  }

  /** Immediate write, cancelling any pending debounce — for unmount/unload. */
  flush(ws: Workspace): AutosaveWriteResult {
    if (this.pendingTimer !== null) {
      this.clearTimer(this.pendingTimer);
      this.pendingTimer = null;
    }
    return this.writeNow(ws);
  }

  private writeNow(ws: Workspace): AutosaveWriteResult {
    if (this.storage === undefined) return { ok: false, reason: "unavailable" };
    try {
      this.storage.setItem(STORAGE_KEY, serializeWorkspace(ws));
      return { ok: true };
    } catch {
      // QuotaExceededError or any other write failure — degrade, never throw.
      return { ok: false, reason: "quota-exceeded" };
    }
  }
}

/**
 * On load, if a saved workspace exists: offer it, don't apply it silently
 * (FR-11.4) — the caller decides what "offer" looks like. A corrupt or
 * version-mismatched entry is discarded rather than surfaced (NFR-4.4).
 */
export function loadSavedWorkspace(
  storage: Storage | undefined = detectAmbientLocalStorage(),
): Workspace | undefined {
  if (storage === undefined) return undefined;
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return undefined;

  const result = deserializeWorkspace(raw);
  if (!result.ok) {
    storage.removeItem(STORAGE_KEY);
    return undefined;
  }
  return result.value;
}

/** FR-11.5 — every key this app has ever written, not just the workspace save. */
export function clearAllLocalData(
  storage: Storage | undefined = detectAmbientLocalStorage(),
): void {
  if (storage === undefined) return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null && (key === STORAGE_KEY || key.startsWith(CARD_CACHE_PREFIX))) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}
