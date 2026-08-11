/**
 * SPEC-B Task B-2 — sorting (FR-3.5): manaValue ascending, name via
 * `Intl.Collator`, quantity descending, all tie-broken by name, never
 * mutating the input.
 */
import { describe, expect, it } from "vitest";
import { aCard } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { Card } from "../model/types";
import type { ResolvedEntry } from "./queries";
import { sortEntries } from "./sort";

function entry(card: Partial<Card>, quantity = 1): ResolvedEntry {
  const full = aCard({ oracleId: toCardId(card.name ?? "card"), ...card });
  return { cardId: full.oracleId, card: full, quantity, zone: "maindeck" };
}

describe("sortEntries — manaValue", () => {
  it("sorts ascending", () => {
    const entries = [entry({ name: "c", manaValue: 3 }), entry({ name: "a", manaValue: 1 })];
    expect(sortEntries(entries, "manaValue").map((e) => e.card.name)).toEqual(["a", "c"]);
  });

  it("ties on manaValue break by name — stable and deterministic regardless of input order", () => {
    const entries = [
      entry({ name: "Zealot", manaValue: 2 }),
      entry({ name: "Abrade", manaValue: 2 }),
    ];
    expect(sortEntries(entries, "manaValue").map((e) => e.card.name)).toEqual(["Abrade", "Zealot"]);
    expect(sortEntries([...entries].reverse(), "manaValue").map((e) => e.card.name)).toEqual([
      "Abrade",
      "Zealot",
    ]);
  });
});

describe("sortEntries — name", () => {
  it("collates accented names where a player expects, not after Z", () => {
    const entries = [
      entry({ name: "Zealot" }),
      entry({ name: "Æther Vial" }),
      entry({ name: "Abrade" }),
    ];
    expect(sortEntries(entries, "name").map((e) => e.card.name)).toEqual([
      "Abrade",
      "Æther Vial",
      "Zealot",
    ]);
  });

  it("collates Lim-Dûl's Vault under L, not after Z", () => {
    const entries = [entry({ name: "Zealot" }), entry({ name: "Lim-Dûl's Vault" })];
    expect(sortEntries(entries, "name").map((e) => e.card.name)).toEqual([
      "Lim-Dûl's Vault",
      "Zealot",
    ]);
  });
});

describe("sortEntries — quantity", () => {
  it("sorts descending", () => {
    const entries = [entry({ name: "a" }, 1), entry({ name: "b" }, 4)];
    expect(sortEntries(entries, "quantity").map((e) => e.card.name)).toEqual(["b", "a"]);
  });

  it("ties on quantity break by name", () => {
    const entries = [entry({ name: "Zealot" }, 2), entry({ name: "Abrade" }, 2)];
    expect(sortEntries(entries, "quantity").map((e) => e.card.name)).toEqual(["Abrade", "Zealot"]);
  });
});

describe("sortEntries — purity", () => {
  it("never mutates the input array", () => {
    const entries = [
      entry({ name: "Zealot", manaValue: 2 }),
      entry({ name: "Abrade", manaValue: 1 }),
    ];
    const original = [...entries];
    sortEntries(entries, "manaValue");
    expect(entries).toEqual(original);
  });

  it("returns a new array", () => {
    const entries = [entry({ name: "a" })];
    expect(sortEntries(entries, "name")).not.toBe(entries);
  });
});
