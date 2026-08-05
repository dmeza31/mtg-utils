import { describe, expect, it } from "vitest";
import { EXPORT_ATTRIBUTION, FAN_CONTENT_DISCLAIMER, SCRYFALL_ATTRIBUTION } from "./attribution";

describe("attribution (NFR-7.1, NFR-7.2, NFR-7.5, FR-10.13)", () => {
  it("names the Fan Content Policy in the disclaimer", () => {
    expect(FAN_CONTENT_DISCLAIMER).toContain("Fan Content Policy");
  });

  it("credits Scryfall without implying affiliation", () => {
    expect(SCRYFALL_ATTRIBUTION).toContain("Scryfall");
    expect(SCRYFALL_ATTRIBUTION).toContain("not affiliated");
  });

  it("combines both disclaimers into the single export-footer string (FR-10.13)", () => {
    expect(EXPORT_ATTRIBUTION).toBe(`${FAN_CONTENT_DISCLAIMER} ${SCRYFALL_ATTRIBUTION}`);
  });
});
