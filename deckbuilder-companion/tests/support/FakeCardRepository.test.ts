/**
 * SPEC-002 Task 2 (NFR-6.4). This is test infrastructure, not domain code,
 * but it stands in for the network in every domain and UI test, so its own
 * contract is worth pinning down: batch resolve, per-name unresolved
 * reporting (FR-2.10), and a peek-cache that reflects prior resolves rather
 * than the whole backing catalog.
 */
import { describe, expect, it } from "vitest";
import { aCard } from "./builders";
import { FakeCardRepository } from "./FakeCardRepository";

describe("FakeCardRepository (NFR-6.4)", () => {
  it("resolves a known name to its card", async () => {
    const bolt = aCard();
    const repo = new FakeCardRepository([bolt]);

    const result = await repo.resolve([{ name: "Lightning Bolt" }]);

    expect(result.cards.get(bolt.oracleId)).toEqual(bolt);
    expect(result.byQueriedName.get("Lightning Bolt")).toBe(bolt.oracleId);
    expect(result.unresolved).toEqual([]);
  });

  it("resolves case-insensitively and trims whitespace", async () => {
    const bolt = aCard();
    const repo = new FakeCardRepository([bolt]);

    const result = await repo.resolve([{ name: "  lightning bolt  " }]);

    expect(result.byQueriedName.get("  lightning bolt  ")).toBe(bolt.oracleId);
  });

  it("reports an unresolved name without throwing (FR-2.10)", async () => {
    const repo = new FakeCardRepository([aCard()]);

    const result = await repo.resolve([{ name: "Lightnin Bolt" }]);

    expect(result.cards.size).toBe(0);
    expect(result.unresolved).toEqual([{ name: "Lightnin Bolt", reason: "not found" }]);
  });

  it("attaches a did-you-mean suggestion for a name it was configured with (FR-2.10)", async () => {
    const repo = new FakeCardRepository([aCard()], { "Lightnin Bolt": "Lightning Bolt" });

    const result = await repo.resolve([{ name: "Lightnin Bolt" }]);

    expect(result.unresolved).toEqual([
      { name: "Lightnin Bolt", reason: "not found", suggestion: "Lightning Bolt" },
    ]);
  });

  it("resolves a batch in one call, mixing hits and misses", async () => {
    const bolt = aCard();
    const repo = new FakeCardRepository([bolt]);

    const result = await repo.resolve([{ name: "Lightning Bolt" }, { name: "Not A Card" }]);

    expect(result.cards.size).toBe(1);
    expect(result.unresolved).toHaveLength(1);
  });

  it("suggest() answers the same fuzzy suggestion resolve() would attach", async () => {
    const repo = new FakeCardRepository([], { "Lightnin Bolt": "Lightning Bolt" });

    await expect(repo.suggest("Lightnin Bolt")).resolves.toBe("Lightning Bolt");
    await expect(repo.suggest("Totally Unknown")).resolves.toBeUndefined();
  });

  describe("peek — cache-only, never I/O (FR-10.12)", () => {
    it("returns undefined before the card has ever been resolved", () => {
      const bolt = aCard();
      const repo = new FakeCardRepository([bolt]);

      expect(repo.peek(bolt.oracleId)).toBeUndefined();
    });

    it("returns the card once resolve() has populated the cache", async () => {
      const bolt = aCard();
      const repo = new FakeCardRepository([bolt]);

      await repo.resolve([{ name: "Lightning Bolt" }]);

      expect(repo.peek(bolt.oracleId)).toEqual(bolt);
    });
  });
});
