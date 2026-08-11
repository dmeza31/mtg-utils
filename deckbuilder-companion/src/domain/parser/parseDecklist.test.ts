/**
 * SPEC-A Task A-3 — one test per fixture (exact maindeck/sideboard totals),
 * plus merge, casing, and NFR-1.1 perf rules.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDecklist } from "./parseDecklist";

function loadFixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

function totals(entries: ReturnType<typeof parseDecklist>["entries"]) {
  return entries.reduce(
    (acc, e) => {
      acc[e.zone] += e.quantity;
      return acc;
    },
    { maindeck: 0, sideboard: 0 },
  );
}

describe("parseDecklist — fixtures", () => {
  it.each([
    ["accented.txt", 42, 15],
    ["arena-setcodes.txt", 36, 15],
    ["dfc-and-split.txt", 56, 15],
    ["header-sideboard.txt", 58, 15],
    ["malformed.txt", 34, 8],
    ["modern-izzet-murktide.txt", 60, 15],
    ["mtgo-blankline.txt", 60, 15],
    ["quantity-x.txt", 60, 15],
    ["undersized.txt", 54, 16],
    ["unresolvable.txt", 32, 4],
    ["workstation-sb-prefix.txt", 58, 15],
  ])("%s parses to maindeck %d / sideboard %d", (file, maindeck, sideboard) => {
    const result = parseDecklist(loadFixture(file));
    expect(totals(result.entries)).toEqual({ maindeck, sideboard });
  });

  it("arena-setcodes.txt attaches the printing hint per entry (FR-1.7.6)", () => {
    const result = parseDecklist(loadFixture("arena-setcodes.txt"));
    const bolt = result.entries.find((e) => e.name === "Lightning Bolt");
    expect(bolt?.printing).toEqual({ set: "2xm", collectorNumber: "129" });
  });

  it("dfc-and-split.txt keeps Fire // Ice separate across zones (no cross-zone merge)", () => {
    const result = parseDecklist(loadFixture("dfc-and-split.txt"));
    const fireIce = result.entries.filter((e) => e.name === "Fire // Ice");
    expect(fireIce).toHaveLength(2);
    expect(fireIce.find((e) => e.zone === "maindeck")?.quantity).toBe(4);
    expect(fireIce.find((e) => e.zone === "sideboard")?.quantity).toBe(3);
  });

  it("workstation-sb-prefix.txt is detected as the sbPrefix variant", () => {
    const result = parseDecklist(loadFixture("workstation-sb-prefix.txt"));
    expect(result.detectedVariant).toBe("sbPrefix");
  });

  it("header-sideboard.txt is detected as the sectionHeader variant", () => {
    const result = parseDecklist(loadFixture("header-sideboard.txt"));
    expect(result.detectedVariant).toBe("sectionHeader");
  });

  it("mtgo-blankline.txt is detected as the blankLineSplit variant", () => {
    const result = parseDecklist(loadFixture("mtgo-blankline.txt"));
    expect(result.detectedVariant).toBe("blankLineSplit");
  });
});

describe("parseDecklist — merge (FR-1.7.7)", () => {
  it("merges duplicate names in the same zone, summing quantities and sourceLines", () => {
    const result = parseDecklist("4 Lightning Bolt\n2 Lightning Bolt");
    expect(result.entries).toEqual([
      { name: "Lightning Bolt", quantity: 6, zone: "maindeck", sourceLines: [1, 2] },
    ]);
  });

  it("does not merge the same name across different zones", () => {
    const result = parseDecklist("Deck\n4 Lightning Bolt\nSideboard\n2 Lightning Bolt");
    expect(result.entries).toHaveLength(2);
  });

  it("merges case- and whitespace-insensitively but preserves first-seen casing", () => {
    const result = parseDecklist("4 lightning bolt\n2 LIGHTNING BOLT");
    expect(result.entries).toEqual([
      { name: "lightning bolt", quantity: 6, zone: "maindeck", sourceLines: [1, 2] },
    ]);
  });
});

describe("parseDecklist — problems", () => {
  it("collects unparseable lines as problems, not thrown errors", () => {
    const result = parseDecklist("4 Lightning Bolt\n0 Lava Spike\n!!!");
    expect(result.problems).toEqual([
      { lineNumber: 2, raw: "0 Lava Spike", reason: "quantity must be greater than zero" },
      { lineNumber: 3, raw: "!!!", reason: "no card name found on this line" },
    ]);
  });
});

describe("parseDecklist — edge cases", () => {
  it("returns empty entries and no problems for an empty string", () => {
    const result = parseDecklist("");
    expect(result.entries).toEqual([]);
    expect(result.problems).toEqual([]);
  });

  it("parses a 75-card list in under 200ms (NFR-1.1)", () => {
    const input = loadFixture("modern-izzet-murktide.txt");
    const start = performance.now();
    parseDecklist(input);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
