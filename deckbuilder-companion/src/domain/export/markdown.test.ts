/**
 * SPEC-E Task E-2 — the Markdown generator. Escaping is the point of this
 * file: it's easy to skip and produces subtly corrupted documents the user
 * only discovers at the tournament (NFR-5.3), so the escaping tests are
 * written before anything about layout.
 */
import { describe, expect, it } from "vitest";
import type { BinderDocument } from "./binder";
import { renderMarkdown } from "./markdown";

function aBinder(overrides: Partial<BinderDocument> = {}): BinderDocument {
  return {
    title: "Izzet Murktide — Sideboard Binder",
    generatedAt: "2026-08-04T00:00:00.000Z",
    deck: {
      name: "Izzet Murktide",
      maindeck: [{ quantity: 4, name: "Lightning Bolt" }],
      maindeckCount: 60,
      sideboard: [{ quantity: 2, name: "Rest in Peace" }],
      sideboardCount: 15,
    },
    matchups: [],
    attribution: "Fan content. Not affiliated with Wizards of the Coast or Scryfall.",
    ...overrides,
  };
}

describe("renderMarkdown", () => {
  it("includes the title, generated date, and deck summary with counts", () => {
    const md = renderMarkdown(aBinder());

    expect(md).toContain("# Izzet Murktide — Sideboard Binder");
    expect(md).toContain("2026-08-04");
    expect(md).toContain("Maindeck (60)");
    expect(md).toContain("4 Lightning Bolt");
    expect(md).toContain("Sideboard (15)");
    expect(md).toContain("2 Rest in Peace");
  });

  it("always includes the attribution", () => {
    const md = renderMarkdown(aBinder({ attribution: "UNIQUE ATTRIBUTION STRING" }));
    expect(md).toContain("UNIQUE ATTRIBUTION STRING");
  });

  it("renders a matchup section with name, priority, game plan, and OUT/IN lines", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "Amulet Titan",
            priority: "high",
            gamePlan: "Be the aggressor.",
            isIncomplete: false,
            variants: [
              {
                label: "Sideboard plan",
                out: [{ quantity: 2, name: "Consider" }],
                in: [{ quantity: 3, name: "Force of Negation" }],
                outTotal: 2,
                inTotal: 3,
                balanceNote: "Unbalanced: 2 out, 3 in",
              },
            ],
          },
        ],
      }),
    );

    expect(md).toContain("Amulet Titan");
    expect(md).toContain("High");
    expect(md).toContain("Be the aggressor.");
    expect(md).toContain("Consider");
    expect(md).toContain("Force of Negation");
    expect(md).toContain("Unbalanced: 2 out, 3 in");
  });

  it("(FR-10.3) a split matchup renders both labelled variants", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "Burn",
            gamePlan: "",
            isIncomplete: false,
            variants: [
              { label: "On the play", out: [], in: [], outTotal: 0, inTotal: 0 },
              { label: "On the draw", out: [], in: [], outTotal: 0, inTotal: 0 },
            ],
          },
        ],
      }),
    );

    expect(md).toContain("On the play");
    expect(md).toContain("On the draw");
  });

  it("a matchup with no plan lines still renders a section, not vanishing", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "No Plan Yet",
            gamePlan: "",
            isIncomplete: true,
            variants: [{ label: "Sideboard plan", out: [], in: [], outTotal: 0, inTotal: 0 }],
          },
        ],
      }),
    );

    expect(md).toContain("No Plan Yet");
  });

  it("per-card notes appear in the output when present", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "Notes Matchup",
            gamePlan: "",
            isIncomplete: false,
            variants: [
              {
                label: "Sideboard plan",
                out: [{ quantity: 1, name: "Lightning Bolt", note: "vs removal" }],
                in: [],
                outTotal: 1,
                inTotal: 0,
              },
            ],
          },
        ],
      }),
    );

    expect(md).toContain("vs removal");
  });

  it("(NFR-5.3) a matchup named 'Deck | Foo' does not corrupt a table", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "Deck | Foo",
            gamePlan: "",
            isIncomplete: false,
            variants: [
              {
                label: "Sideboard plan",
                out: [{ quantity: 1, name: "Lightning Bolt" }],
                in: [{ quantity: 1, name: "Rest in Peace" }],
                outTotal: 1,
                inTotal: 1,
              },
            ],
          },
        ],
      }),
    );

    // The pipe is escaped, and the row structure survives: every non-empty
    // table line has the same number of unescaped `|` delimiters.
    expect(md).toContain("Deck \\| Foo");
    const tableLines = md.split("\n").filter((line) => line.trimStart().startsWith("|"));
    expect(tableLines.length).toBeGreaterThan(0);
    const pipeCounts = new Set(tableLines.map((line) => (line.match(/(?<!\\)\|/g) ?? []).length));
    expect(pipeCounts.size).toBe(1);
  });

  it("(NFR-5.3) markdown special characters in card/matchup names are escaped", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "*Bold* _Italic_ #Hash `Code`",
            gamePlan: "",
            isIncomplete: false,
            variants: [{ label: "Sideboard plan", out: [], in: [], outTotal: 0, inTotal: 0 }],
          },
        ],
      }),
    );

    expect(md).toContain("\\*Bold\\* \\_Italic\\_ \\#Hash \\`Code\\`");
  });

  it("(NFR-5.3) an injected link/image/HTML in the game plan never becomes live markup", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "Injection",
            gamePlan: "Click [here](javascript:alert(1)) or <script>alert(1)</script>",
            isIncomplete: false,
            variants: [{ label: "Sideboard plan", out: [], in: [], outTotal: 0, inTotal: 0 }],
          },
        ],
      }),
    );

    expect(md).not.toContain("[here](javascript:alert(1))");
    expect(md).not.toContain("<script>");
  });

  it("preserves the user's own bold/italic/bullet markdown in the game plan", () => {
    const md = renderMarkdown(
      aBinder({
        matchups: [
          {
            name: "Formatting",
            gamePlan: "**Race** them, *carefully*.\n- board out slow cards",
            isIncomplete: false,
            variants: [{ label: "Sideboard plan", out: [], in: [], outTotal: 0, inTotal: 0 }],
          },
        ],
      }),
    );

    expect(md).toContain("**Race**");
    expect(md).toContain("*carefully*");
    expect(md).toContain("- board out slow cards");
  });

  it("is deterministic — two calls on the same document produce byte-identical output", () => {
    const doc = aBinder({
      matchups: [
        {
          name: "Amulet Titan",
          gamePlan: "Race them.",
          isIncomplete: false,
          variants: [
            {
              label: "Sideboard plan",
              out: [{ quantity: 2, name: "Consider" }],
              in: [{ quantity: 3, name: "Force of Negation" }],
              outTotal: 2,
              inTotal: 3,
            },
          ],
        },
      ],
    });

    expect(renderMarkdown(doc)).toBe(renderMarkdown(doc));
  });
});
