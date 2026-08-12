/**
 * SPEC-E Task E-7 (FR-11.4, R-1). The single most valuable behaviour in
 * this file is "a crash on load never happens" — a debounced write that
 * throws, or a saved file that can't be parsed, must degrade to a warning
 * or a clean empty state, never an unhandled exception on startup.
 *
 * jsdom project, fake injected `Storage` — see `CardCache.dom.test.ts` for
 * why the ambient `localStorage` global isn't trusted in this Node version.
 */
import { describe, expect, it, vi } from "vitest";
import { aDeck, aMatchup } from "../../../tests/support/builders";
import type { Workspace } from "../../domain/model/types";
import { Autosave, clearAllLocalData, loadSavedWorkspace, STORAGE_KEY } from "./autosave";

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

const workspace: Workspace = {
  schemaVersion: 1,
  deck: aDeck(),
  matchups: [aMatchup({ name: "Burn" })],
};

describe("Autosave", () => {
  it("debounces: scheduling twice within the window writes once, with the latest value", () => {
    vi.useFakeTimers();
    const storage = createFakeStorage();
    const autosave = new Autosave({ storage, debounceMs: 1000 });

    autosave.schedule(workspace);
    autosave.schedule({ ...workspace, matchups: [aMatchup({ name: "Tron" })] });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(1000);

    const saved = storage.getItem(STORAGE_KEY);
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved ?? "")).toMatchObject({ matchups: [{ name: "Tron" }] });
    vi.useRealTimers();
  });

  it("flush() writes immediately and cancels any pending debounce", () => {
    vi.useFakeTimers();
    const storage = createFakeStorage();
    const autosave = new Autosave({ storage, debounceMs: 1000 });

    autosave.schedule(workspace);
    const result = autosave.flush(workspace);

    expect(result.ok).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    vi.useRealTimers();
  });

  it("(NFR-4.4) a QuotaExceededError degrades to a warning result — the app keeps working", () => {
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
    const autosave = new Autosave({ storage: fakeStorage });

    const result = autosave.flush(workspace);

    expect(result).toEqual({ ok: false, reason: "quota-exceeded" });
  });

  it("namespaces its key as dbc:workspace:v1", () => {
    const storage = createFakeStorage();
    new Autosave({ storage }).flush(workspace);
    expect(storage.getItem("dbc:workspace:v1")).not.toBeNull();
  });
});

describe("loadSavedWorkspace", () => {
  it("returns undefined when nothing is saved", () => {
    expect(loadSavedWorkspace(createFakeStorage())).toBeUndefined();
  });

  it("returns the saved workspace when present and valid", () => {
    const storage = createFakeStorage();
    new Autosave({ storage }).flush(workspace);
    expect(loadSavedWorkspace(storage)).toEqual(workspace);
  });

  it("(NFR-4.4) discards corrupt saved JSON rather than throwing", () => {
    const storage = createFakeStorage();
    storage.setItem(STORAGE_KEY, "{not valid json");

    expect(() => loadSavedWorkspace(storage)).not.toThrow();
    expect(loadSavedWorkspace(storage)).toBeUndefined();
    expect(storage.getItem(STORAGE_KEY)).toBeNull(); // discarded, not left behind
  });

  it("(FR-11.3) discards a saved file from a newer schema version rather than throwing", () => {
    const storage = createFakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, matchups: [] }));

    expect(() => loadSavedWorkspace(storage)).not.toThrow();
    expect(loadSavedWorkspace(storage)).toBeUndefined();
  });
});

describe("clearAllLocalData (FR-11.5)", () => {
  it("removes the autosaved workspace and every namespaced card-cache entry", () => {
    const storage = createFakeStorage();
    storage.setItem(STORAGE_KEY, "{}");
    storage.setItem("dbc:cards:v1:oracle-1", "{}");
    storage.setItem("unrelated-key", "should survive");

    clearAllLocalData(storage);

    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem("dbc:cards:v1:oracle-1")).toBeNull();
    expect(storage.getItem("unrelated-key")).toBe("should survive");
  });
});
