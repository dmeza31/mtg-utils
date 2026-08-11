/**
 * SPEC-A Task A-1 — table-driven tests for the line tokenizer (FR-1.7).
 */
import { describe, expect, it } from "vitest";
import { tokenizeLines } from "./tokenize";

describe("tokenizeLines", () => {
  it("parses a plain quantity + name line (FR-1.7)", () => {
    const [line] = tokenizeLines("4 Lightning Bolt");
    expect(line).toEqual({
      kind: "card",
      quantity: 4,
      name: "Lightning Bolt",
      lineNumber: 1,
      raw: "4 Lightning Bolt",
    });
  });

  it("parses the 4x quantity variant (FR-1.7)", () => {
    const [line] = tokenizeLines("4x Lightning Bolt");
    expect(line).toMatchObject({ kind: "card", quantity: 4, name: "Lightning Bolt" });
  });

  it("defaults to quantity 1 when no quantity is given (FR-1.7.5)", () => {
    const [line] = tokenizeLines("Lightning Bolt");
    expect(line).toMatchObject({ kind: "card", quantity: 1, name: "Lightning Bolt" });
  });

  it("extracts a printing suffix (FR-1.7.6)", () => {
    const [line] = tokenizeLines("4 Lightning Bolt (2XM) 129");
    expect(line).toMatchObject({
      kind: "card",
      quantity: 4,
      name: "Lightning Bolt",
      printing: { set: "2xm", collectorNumber: "129" },
    });
  });

  it("parses an SB: prefixed card line", () => {
    const [line] = tokenizeLines("SB: 3 Chalice of the Void");
    expect(line).toMatchObject({
      kind: "card",
      quantity: 3,
      name: "Chalice of the Void",
      raw: "SB: 3 Chalice of the Void",
    });
  });

  it.each(["// comment", "# comment"])("treats %s as a comment (FR-1.7.2)", (raw) => {
    const [line] = tokenizeLines(raw);
    expect(line).toEqual({ kind: "comment", lineNumber: 1 });
  });

  it.each(["Sideboard", "Sideboard:", "SIDEBOARD"])(
    "treats %s as a sideboard section header (case-insensitive)",
    (raw) => {
      const [line] = tokenizeLines(raw);
      expect(line).toEqual({ kind: "section", section: "sideboard", lineNumber: 1 });
    },
  );

  it.each(["Deck", "Maindeck"])("treats %s as a deck section header", (raw) => {
    const [line] = tokenizeLines(raw);
    expect(line).toEqual({ kind: "section", section: "deck", lineNumber: 1 });
  });

  it.each(["", "   "])("treats %j as blank", (raw) => {
    const [line] = tokenizeLines(raw);
    expect(line).toEqual({ kind: "blank", lineNumber: 1 });
  });

  it("normalises \\r\\n line endings (FR-1.7.1)", () => {
    const lines = tokenizeLines("4 Lightning Bolt\r\n4 Lava Spike\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ kind: "card", name: "Lightning Bolt", lineNumber: 1 });
    expect(lines[1]).toMatchObject({ kind: "card", name: "Lava Spike", lineNumber: 2 });
    expect(lines[2]).toEqual({ kind: "blank", lineNumber: 3 });
  });

  it("preserves split card names (FR-1.7.4)", () => {
    const [line] = tokenizeLines("4 Fire // Ice");
    expect(line).toMatchObject({ kind: "card", quantity: 4, name: "Fire // Ice" });
  });

  it("collapses internal whitespace in names", () => {
    const [line] = tokenizeLines("4  Lightning   Bolt");
    expect(line).toMatchObject({ kind: "card", quantity: 4, name: "Lightning Bolt" });
  });

  it("extracts a printing suffix even with no quantity prefix", () => {
    const [line] = tokenizeLines("Lightning Bolt (2XM) 129");
    expect(line).toMatchObject({
      kind: "card",
      quantity: 1,
      name: "Lightning Bolt",
      printing: { set: "2xm", collectorNumber: "129" },
    });
  });

  it("preserves diacritics in names", () => {
    const [line] = tokenizeLines("Lim-Dûl's Vault");
    expect(line).toMatchObject({ kind: "card", quantity: 1, name: "Lim-Dûl's Vault" });
  });

  it("marks a line with no discernible name as unparseable", () => {
    const [line] = tokenizeLines("!!!");
    expect(line?.kind).toBe("unparseable");
    expect(line).toMatchObject({ lineNumber: 1, raw: "!!!" });
    if (line?.kind === "unparseable") {
      expect(line.reason.length).toBeGreaterThan(0);
    }
  });

  it("marks a zero quantity as unparseable", () => {
    const [line] = tokenizeLines("0 Lightning Bolt");
    expect(line?.kind).toBe("unparseable");
    if (line?.kind === "unparseable") {
      expect(line.reason).toMatch(/zero/i);
    }
  });

  it("does not validate legality — a huge quantity still parses as a card (FR-4 owns legality)", () => {
    const [line] = tokenizeLines("999 Lightning Bolt");
    expect(line).toMatchObject({ kind: "card", quantity: 999, name: "Lightning Bolt" });
  });

  it("assigns sequential line numbers across a multi-line input", () => {
    const lines = tokenizeLines("Deck\n4 Lightning Bolt\n\nSideboard\n2 Abrade");
    expect(lines.map((l) => l.lineNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(lines.map((l) => l.kind)).toEqual(["section", "card", "blank", "section", "card"]);
  });
});
