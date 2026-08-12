/**
 * SPEC-E Task E-2 (FR-10.4). Renders a `BinderDocument` to a Markdown
 * string. Two escaping strategies, not one:
 *
 * - `escapeInline` for text that must never be interpreted as Markdown at
 *   all (matchup names, card names, per-card notes) — every special
 *   character is neutralised.
 * - `sanitizeGamePlan` for the game plan body, which intentionally carries
 *   the user's own bold/italic/bullet Markdown (D-8) and must keep
 *   rendering as such — only the characters that could turn it into
 *   something *live* (a link, an image, raw HTML, a heading) are escaped.
 *
 * NFR-5.3 is what makes this file's tests be escaping tests before they are
 * layout tests: a matchup named `Deck | Foo` must not corrupt a table, and
 * an injected link or `<script>` must never become active markup.
 */
import type { BinderDocument, BinderMatchup, BinderPlanLine, BinderPlanVariant } from "./binder";

function escapeInline(text: string): string {
  return text.replace(/[\\`*_#|[\]]/g, (char) => `\\${char}`);
}

/** Kills links, images, raw HTML and headings; leaves *,_,- so the user's own formatting still renders. */
function sanitizeGamePlan(text: string): string {
  return text.replace(/[\\`|[\]<>]/g, (char) => `\\${char}`).replace(/^#/gm, "\\#");
}

function priorityLabel(priority: BinderMatchup["priority"]): string {
  if (priority === undefined) return "";
  return `  ·  ${priority[0]?.toUpperCase()}${priority.slice(1)} priority`;
}

function renderLine(line: BinderPlanLine): string {
  const base = `${line.quantity} ${escapeInline(line.name)}`;
  return line.note !== undefined ? `${base} (${escapeInline(line.note)})` : base;
}

function renderTable(out: readonly BinderPlanLine[], inLines: readonly BinderPlanLine[]): string {
  if (out.length === 0 && inLines.length === 0) {
    return "*(no cards planned)*";
  }

  const rowCount = Math.max(out.length, inLines.length);
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const outCell = out[i] !== undefined ? renderLine(out[i]!) : "";
    const inCell = inLines[i] !== undefined ? renderLine(inLines[i]!) : "";
    return `| ${outCell} | ${inCell} |`;
  });

  return ["| Out | In |", "|---|---|", ...rows].join("\n");
}

function renderVariant(variant: BinderPlanVariant): string {
  const lines = [
    `**${variant.label}** — ${variant.outTotal} out / ${variant.inTotal} in`,
    ...(variant.balanceNote !== undefined ? [`*${escapeInline(variant.balanceNote)}*`] : []),
    "",
    renderTable(variant.out, variant.in),
  ];
  return lines.join("\n");
}

function renderMatchup(matchup: BinderMatchup): string {
  const heading = `## vs. ${escapeInline(matchup.name)}${priorityLabel(matchup.priority)}`;
  const sections = [
    heading,
    "",
    "**Game plan**",
    matchup.gamePlan.trim() === "" ? "*(none yet)*" : sanitizeGamePlan(matchup.gamePlan),
    "",
    ...matchup.variants.map((variant) => renderVariant(variant)),
  ];
  return sections.join("\n");
}

function renderDeckLines(lines: readonly BinderPlanLine[]): string {
  return lines.length === 0 ? "*(empty)*" : lines.map(renderLine).join("\n");
}

export function renderMarkdown(doc: BinderDocument): string {
  const generatedDate = doc.generatedAt.slice(0, 10);

  const sections = [
    `# ${escapeInline(doc.title)}`,
    `*Generated ${generatedDate}*`,
    "",
    "## Deck",
    `**Maindeck (${doc.deck.maindeckCount})**`,
    renderDeckLines(doc.deck.maindeck),
    "",
    `**Sideboard (${doc.deck.sideboardCount})**`,
    renderDeckLines(doc.deck.sideboard),
    "",
    ...doc.matchups.flatMap((matchup) => ["---", "", renderMatchup(matchup), ""]),
    "---",
    "",
    escapeInline(doc.attribution),
  ];

  return sections.join("\n");
}
