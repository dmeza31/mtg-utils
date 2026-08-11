/**
 * SPEC-A Task A-4 — MTGO `.dek` XML parser (FR-1.3, priority S). Malformed
 * XML must produce a `ParseProblem`, never a thrown exception escaping the
 * domain.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDekXml } from "./parseDekXml";

function loadFixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

describe("parseDekXml", () => {
  it("normalises a valid .dek export into a ParsedDecklist", () => {
    const result = parseDekXml(loadFixture("mtgo-export.dek"));
    expect(result.detectedVariant).toBe("dekXml");
    expect(result.problems).toEqual([]);
    expect(result.entries).toEqual([
      { name: "Lightning Bolt", quantity: 4, zone: "maindeck", sourceLines: [1] },
      { name: "Monastery Swiftspear", quantity: 4, zone: "maindeck", sourceLines: [2] },
      { name: "Mountain", quantity: 16, zone: "maindeck", sourceLines: [3] },
      { name: "Rest in Peace", quantity: 3, zone: "sideboard", sourceLines: [4] },
      { name: "Alpine Moon", quantity: 2, zone: "sideboard", sourceLines: [5] },
    ]);
  });

  it("reports missing Quantity/Name attributes as problems instead of throwing", () => {
    const result = parseDekXml(loadFixture("malformed.dek"));
    expect(result.entries).toEqual([
      { name: "Lightning Bolt", quantity: 4, zone: "maindeck", sourceLines: [1] },
    ]);
    expect(result.problems).toHaveLength(2);
    expect(result.problems[0]?.reason).toMatch(/quantity/i);
    expect(result.problems[1]?.reason).toMatch(/name/i);
  });

  it("reports a document with no <Deck> root as malformed, never throws", () => {
    expect(() => parseDekXml("not xml at all")).not.toThrow();
    const result = parseDekXml("not xml at all");
    expect(result.entries).toEqual([]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.reason).toMatch(/malformed/i);
  });

  it("merges duplicate names within a zone (FR-1.7.7)", () => {
    const xml = `<Deck>
      <Cards Quantity="2" Sideboard="false" Name="Lightning Bolt" />
      <Cards Quantity="2" Sideboard="false" Name="Lightning Bolt" />
    </Deck>`;
    const result = parseDekXml(xml);
    expect(result.entries).toEqual([
      { name: "Lightning Bolt", quantity: 4, zone: "maindeck", sourceLines: [1, 2] },
    ]);
  });
});
