/**
 * SPEC-A Task A-2 — zone assignment precedence (FR-1.7.3).
 */
import { describe, expect, it } from "vitest";
import { tokenizeLines } from "./tokenize";
import { assignZones } from "./assignZones";

function zonesOf(input: string): (string | undefined)[] {
  const lines = tokenizeLines(input);
  const zones = assignZones(lines);
  return lines.filter((l) => l.kind === "card").map((l) => zones.get(l.lineNumber));
}

describe("assignZones", () => {
  it("rule 1: SB: prefix alone decides the zone, blank lines ignored", () => {
    const zones = zonesOf("4 Lightning Bolt\n\nSB: 3 Chalice of the Void\nSB: 2 Rest in Peace");
    expect(zones).toEqual(["maindeck", "sideboard", "sideboard"]);
  });

  it("rule 1: mixed SB: prefixes and blank lines still follow rule 1", () => {
    const zones = zonesOf(
      "4 Lightning Bolt\n4 Lava Spike\n\nSB: 3 Chalice of the Void\n4 Wild Slash",
    );
    // "4 Wild Slash" has no SB: prefix, so under rule 1 it's maindeck even
    // though it comes after the blank line and an SB: line.
    expect(zones).toEqual(["maindeck", "maindeck", "sideboard", "maindeck"]);
  });

  it("rule 2: an explicit Sideboard header decides the zone", () => {
    const zones = zonesOf("Deck\n4 Lightning Bolt\nSideboard\n2 Abrade");
    expect(zones).toEqual(["maindeck", "sideboard"]);
  });

  it("rule 2: blank lines inside a header-delimited list never create a third zone", () => {
    const zones = zonesOf(
      "Deck\n4 Lightning Bolt\n\n4 Monastery Swiftspear\nSideboard\n2 Abrade\n\n2 Rest in Peace",
    );
    expect(zones).toEqual(["maindeck", "maindeck", "sideboard", "sideboard"]);
  });

  it("rule 3: the first blank-line run with cards on both sides splits maindeck from sideboard", () => {
    const zones = zonesOf("4 Lightning Bolt\n4 Lava Spike\n\n2 Abrade\n3 Rest in Peace");
    expect(zones).toEqual(["maindeck", "maindeck", "sideboard", "sideboard"]);
  });

  it("rule 3: leading blank lines are never treated as a separator", () => {
    const zones = zonesOf("\n\n4 Lightning Bolt\n4 Lava Spike");
    expect(zones).toEqual(["maindeck", "maindeck"]);
  });

  it("rule 3: trailing blank lines are never treated as a separator", () => {
    const zones = zonesOf("4 Lightning Bolt\n4 Lava Spike\n\n\n");
    expect(zones).toEqual(["maindeck", "maindeck"]);
  });

  it("rule 3: multiple consecutive blank lines count as one separator", () => {
    const zones = zonesOf("4 Lightning Bolt\n\n\n\n2 Abrade");
    expect(zones).toEqual(["maindeck", "sideboard"]);
  });

  it("rule 4: a list with a blank line but no cards after it is entirely maindeck", () => {
    const zones = zonesOf("4 Lightning Bolt\n4 Lava Spike\n\n");
    expect(zones).toEqual(["maindeck", "maindeck"]);
  });

  it("rule 4: no blank line and no header means everything is maindeck", () => {
    const zones = zonesOf("4 Lightning Bolt\n4 Lava Spike\n2 Abrade");
    expect(zones).toEqual(["maindeck", "maindeck", "maindeck"]);
  });
});
