/**
 * SPEC-A Task A-5 — printing eligibility and oldest-print selection
 * (FR-2.13, FR-2.14, D-6). Table-driven: one row per eligibility rule, one
 * per tiebreak level, plus the determinism guarantee FR-2.14 requires.
 */
import { describe, expect, it } from "vitest";
import { isEligiblePrinting, selectOldestPrinting, type PrintingCandidate } from "./policy";

function aCandidate(overrides: Partial<PrintingCandidate> = {}): PrintingCandidate {
  return {
    id: "id-1",
    set: "lea",
    setType: "core",
    releasedAt: "1993-08-05",
    games: ["paper"],
    digital: false,
    collectorNumber: "161",
    imageUris: { normal: "https://example.com/card.jpg" },
    ...overrides,
  };
}

describe("isEligiblePrinting", () => {
  it("is eligible when it's a paper, non-digital, non-excluded-set-type printing with an image", () => {
    expect(isEligiblePrinting(aCandidate())).toBe(true);
  });

  it("rejects a printing without 'paper' in games", () => {
    expect(isEligiblePrinting(aCandidate({ games: ["arena"] }))).toBe(false);
  });

  it("rejects a digital printing", () => {
    expect(isEligiblePrinting(aCandidate({ digital: true }))).toBe(false);
  });

  it.each(["memorabilia", "token", "minigame", "alchemy"])("rejects setType %s", (setType) => {
    expect(isEligiblePrinting(aCandidate({ setType }))).toBe(false);
  });

  it("rejects a printing with no usable image", () => {
    const { imageUris, ...withoutImage } = aCandidate();
    void imageUris;
    expect(isEligiblePrinting(withoutImage)).toBe(false);
  });

  it("rejects a printing with an image_uris object but no usable sizes", () => {
    expect(isEligiblePrinting(aCandidate({ imageUris: {} }))).toBe(false);
  });
});

describe("selectOldestPrinting", () => {
  it("returns undefined for an empty candidate list", () => {
    expect(selectOldestPrinting([])).toBeUndefined();
  });

  it("returns undefined when every candidate is ineligible", () => {
    const candidates = [aCandidate({ digital: true }), aCandidate({ games: ["mtgo"] })];
    expect(selectOldestPrinting(candidates)).toBeUndefined();
  });

  it("selects the earliest releasedAt among eligible candidates", () => {
    const oldest = aCandidate({ id: "old", releasedAt: "1993-08-05" });
    const newer = aCandidate({ id: "new", releasedAt: "2020-01-01" });
    expect(selectOldestPrinting([newer, oldest])?.id).toBe("old");
  });

  it("ignores ineligible candidates even if they're older", () => {
    const ineligibleOld = aCandidate({ id: "ineligible", releasedAt: "1990-01-01", digital: true });
    const eligible = aCandidate({ id: "eligible", releasedAt: "2000-01-01" });
    expect(selectOldestPrinting([ineligibleOld, eligible])?.id).toBe("eligible");
  });

  it("tiebreak 1: on equal dates, prefers non-promo set type over promo", () => {
    const promo = aCandidate({ id: "promo", releasedAt: "2000-01-01", setType: "promo" });
    const core = aCandidate({ id: "core", releasedAt: "2000-01-01", setType: "core" });
    expect(selectOldestPrinting([promo, core])?.id).toBe("core");
  });

  it("tiebreak 2: on equal date and promo-status, prefers lexicographically smaller set code", () => {
    const setZ = aCandidate({ id: "z", releasedAt: "2000-01-01", set: "zzz" });
    const setA = aCandidate({ id: "a", releasedAt: "2000-01-01", set: "aaa" });
    expect(selectOldestPrinting([setZ, setA])?.id).toBe("a");
  });

  it("tiebreak 3: on equal date, promo-status, and set, prefers numerically smaller collector number", () => {
    const high = aCandidate({
      id: "high",
      releasedAt: "2000-01-01",
      set: "abc",
      collectorNumber: "20",
    });
    const low = aCandidate({
      id: "low",
      releasedAt: "2000-01-01",
      set: "abc",
      collectorNumber: "9",
    });
    expect(selectOldestPrinting([high, low])?.id).toBe("low");
  });

  it("tiebreak 3: falls back to lexicographic comparison for non-numeric collector numbers", () => {
    const b = aCandidate({ id: "b", releasedAt: "2000-01-01", set: "abc", collectorNumber: "b" });
    const a = aCandidate({ id: "a", releasedAt: "2000-01-01", set: "abc", collectorNumber: "a" });
    expect(selectOldestPrinting([b, a])?.id).toBe("a");
  });

  it("is deterministic across shuffled input order (FR-2.14)", () => {
    const candidates = [
      aCandidate({ id: "a", releasedAt: "2000-01-01", set: "abc", collectorNumber: "9" }),
      aCandidate({ id: "b", releasedAt: "2000-01-01", set: "abc", collectorNumber: "20" }),
      aCandidate({ id: "c", releasedAt: "1995-06-01" }),
      aCandidate({ id: "d", releasedAt: "2010-03-01" }),
    ];

    const first = selectOldestPrinting(candidates)?.id;
    for (let i = 0; i < 20; i++) {
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      expect(selectOldestPrinting(shuffled)?.id).toBe(first);
    }
  });
});
