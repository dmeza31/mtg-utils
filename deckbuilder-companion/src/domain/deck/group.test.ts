/**
 * SPEC-B Task B-1 — grouping (FR-3.4). Each rule in the spec gets its own
 * test: type-priority order, DFC/adventure/split face selection, empty
 * groups omitted, colour-identity-not-cost, mana-value land exclusion.
 */
import { describe, expect, it } from "vitest";
import { aCard } from "../../../tests/support/builders";
import { toCardId } from "../model/types";
import type { Card } from "../model/types";
import type { ResolvedEntry } from "./queries";
import { groupEntries } from "./group";

function entry(card: Partial<Card>, quantity = 1): ResolvedEntry {
  const full = aCard({ oracleId: toCardId(card.name ?? "card"), ...card });
  return { cardId: full.oracleId, card: full, quantity, zone: "maindeck" };
}

describe("groupEntries — type (FR-3.4)", () => {
  it("groups in deckbuilding order: Creature, Planeswalker, Instant, Sorcery, Artifact, Enchantment, Battle, Land", () => {
    const entries = [
      entry({ name: "Land", typeLine: "Basic Land — Forest" }),
      entry({ name: "Enchantment", typeLine: "Enchantment" }),
      entry({ name: "Artifact", typeLine: "Artifact" }),
      entry({ name: "Sorcery", typeLine: "Sorcery" }),
      entry({ name: "Instant", typeLine: "Instant" }),
      entry({ name: "Planeswalker", typeLine: "Legendary Planeswalker — Jace" }),
      entry({ name: "Creature", typeLine: "Creature — Human Wizard" }),
      entry({ name: "Battle", typeLine: "Battle — Siege" }),
    ];
    const groups = groupEntries(entries, "type");
    expect(groups.map((g) => g.label)).toEqual([
      "Creatures",
      "Planeswalkers",
      "Instants",
      "Sorceries",
      "Artifacts",
      "Enchantments",
      "Battles",
      "Lands",
    ]);
  });

  it("an Artifact Creature groups under Creature (first matching type in priority order)", () => {
    const groups = groupEntries([entry({ typeLine: "Artifact Creature — Golem" })], "type");
    expect(groups).toEqual([{ key: "creature", label: "Creatures", entries: expect.any(Array) }]);
  });

  it("a Land Creature (Dryad Arbor) groups under Creature, not Land", () => {
    const groups = groupEntries(
      [entry({ name: "Dryad Arbor", typeLine: "Land Creature — Forest Dryad" })],
      "type",
    );
    expect(groups.map((g) => g.label)).toEqual(["Creatures"]);
  });

  it("a modal DFC groups by the front face's type", () => {
    const card = entry({
      name: "Agadeem's Awakening",
      typeLine: "Sorcery // Land",
      faces: [
        { name: "Agadeem's Awakening", typeLine: "Sorcery" },
        { name: "Agadeem, the Undercrypt", typeLine: "Land" },
      ],
    });
    expect(groupEntries([card], "type").map((g) => g.label)).toEqual(["Sorceries"]);
  });

  it("an adventure card groups by the creature half", () => {
    const card = entry({
      name: "Bonecrusher Giant",
      typeLine: "Creature — Giant // Sorcery — Adventure",
      faces: [
        { name: "Bonecrusher Giant", typeLine: "Creature — Giant" },
        { name: "Stomp", typeLine: "Sorcery — Adventure" },
      ],
    });
    expect(groupEntries([card], "type").map((g) => g.label)).toEqual(["Creatures"]);
  });

  it("a split card groups by the front half's type", () => {
    const card = entry({
      name: "Fire // Ice",
      typeLine: "Instant // Instant",
      faces: [
        { name: "Fire", typeLine: "Instant" },
        { name: "Ice", typeLine: "Instant" },
      ],
    });
    expect(groupEntries([card], "type").map((g) => g.label)).toEqual(["Instants"]);
  });

  it("empty groups are omitted, never rendered as empty headers", () => {
    const groups = groupEntries([entry({ typeLine: "Creature — Human" })], "type");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Creatures");
  });
});

describe("groupEntries — none", () => {
  it("returns exactly one group", () => {
    const groups = groupEntries(
      [entry({ typeLine: "Creature" }), entry({ typeLine: "Land" })],
      "none",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries).toHaveLength(2);
  });

  it("returns exactly one group even for an empty deck", () => {
    expect(groupEntries([], "none")).toHaveLength(1);
  });
});

describe("groupEntries — color (colour identity, not cast cost)", () => {
  it("orders WUBRG, then Multicolour, then Colourless", () => {
    const entries = [
      entry({ name: "colorless", colorIdentity: [] }),
      entry({ name: "multi", colorIdentity: ["R", "G"] }),
      entry({ name: "green", colorIdentity: ["G"] }),
      entry({ name: "red", colorIdentity: ["R"] }),
      entry({ name: "black", colorIdentity: ["B"] }),
      entry({ name: "blue", colorIdentity: ["U"] }),
      entry({ name: "white", colorIdentity: ["W"] }),
    ];
    const groups = groupEntries(entries, "color");
    expect(groups.map((g) => g.label)).toEqual([
      "White",
      "Blue",
      "Black",
      "Red",
      "Green",
      "Multicolor",
      "Colorless",
    ]);
  });

  it("groups by colour identity, not mana cost — a Devoid card with a colourless cost still buckets by identity", () => {
    const devoid = entry({ name: "Devoid Bolt", manaCost: "{R}", colorIdentity: ["R"] });
    const groups = groupEntries([devoid], "color");
    expect(groups.map((g) => g.label)).toEqual(["Red"]);
  });
});

describe("groupEntries — manaValue", () => {
  it("buckets 0 through 6, then 7+", () => {
    const entries = [0, 1, 2, 3, 4, 5, 6, 7, 9].map((mv) =>
      entry({ name: `mv${mv}`, manaValue: mv, typeLine: "Instant" }),
    );
    const groups = groupEntries(entries, "manaValue");
    expect(groups.map((g) => g.label)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7+"]);
    expect(groups.find((g) => g.label === "7+")?.entries).toHaveLength(2);
  });

  it("excludes lands entirely, even a 0-cost land grouping bucket", () => {
    const entries = [
      entry({ name: "bolt", manaValue: 1, typeLine: "Instant" }),
      entry({ name: "forest", manaValue: 0, typeLine: "Basic Land — Forest" }),
    ];
    const groups = groupEntries(entries, "manaValue");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("1");
  });
});
