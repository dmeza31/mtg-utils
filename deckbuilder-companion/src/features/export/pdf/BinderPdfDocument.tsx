/**
 * SPEC-E Task E-3 (FR-10.5–10.8). The PDF document, built on
 * `@react-pdf/renderer`. This module pulls in the whole PDF renderer at
 * import time, which is why nothing outside `features/export/pdf/` ever
 * imports it directly — callers reach it through a dynamic `import()` so
 * the renderer never lands in the initial bundle (NFR-1.5).
 *
 * Q-3 (requirements doc): compact continuous flow, not one matchup per
 * physical page — `wrap={false}` on each matchup's own container is what
 * keeps a section from splitting *unnecessarily* (FR-10.6) without forcing
 * a page break for every matchup regardless of length.
 *
 * B&W legible (FR-10.7): OUT/IN are distinguished by heading text and a
 * −/+ glyph, never by colour. The only colour used anywhere is a single
 * dark gray for de-emphasised text (the generated-date line), which prints
 * identically in black and white.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  BinderDocument,
  BinderMatchup,
  BinderPlanLine,
  BinderPlanVariant,
} from "@/domain/export/binder";

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 32, fontSize: 10 },
  // `lineHeight` lives here, not on `page` — react-pdf silently drops the
  // `fixed` footer when the Page style itself sets lineHeight (reproduced
  // in isolation; a yoga-layout interaction, not anything about the footer
  // itself). Scoping it to the body wrapper avoids the bug entirely.
  body: { lineHeight: 1.35 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#444444", marginBottom: 14 },
  sectionHeading: { fontSize: 11, fontWeight: 700, marginBottom: 6, marginTop: 4 },
  deckColumns: { flexDirection: "row", gap: 24, marginBottom: 16 },
  deckColumn: { flex: 1 },
  deckColumnHeading: { fontWeight: 700, marginBottom: 4 },
  deckLine: { marginBottom: 1 },
  matchup: {
    marginBottom: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    borderTopStyle: "solid",
  },
  matchupHeadingRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  matchupHeading: { fontSize: 13, fontWeight: 700 },
  matchupPriority: { fontSize: 10, fontWeight: 700 },
  incompleteFlag: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  gamePlanLine: { marginBottom: 2 },
  variant: { marginTop: 6 },
  variantHeading: { fontWeight: 700, marginBottom: 3 },
  variantColumns: { flexDirection: "row", gap: 16 },
  variantColumn: { flex: 1 },
  variantColumnHeading: { fontWeight: 700, marginBottom: 2 },
  planLine: { marginBottom: 1 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
});

/** PDF has no markdown renderer — bullets become "•", emphasis markers are dropped rather than shown literally. */
function plainTextLines(gamePlan: string): readonly string[] {
  if (gamePlan.trim() === "") return ["(none yet)"];
  return gamePlan
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "• ").replace(/\*\*?/g, ""))
    .filter((line) => line.trim() !== "");
}

function priorityLabel(priority: BinderMatchup["priority"]): string | undefined {
  if (priority === undefined) return undefined;
  return `${priority[0]?.toUpperCase()}${priority.slice(1)} priority`;
}

function renderPlanLine(line: BinderPlanLine, glyph: "-" | "+"): string {
  const base = `${glyph} ${line.quantity} ${line.name}`;
  return line.note !== undefined ? `${base} (${line.note})` : base;
}

function DeckColumn({ heading, lines }: { heading: string; lines: readonly BinderPlanLine[] }) {
  return (
    <View style={styles.deckColumn}>
      <Text style={styles.deckColumnHeading}>{heading}</Text>
      {lines.map((line) => (
        <Text key={line.name} style={styles.deckLine}>
          {line.quantity} {line.name}
        </Text>
      ))}
    </View>
  );
}

function VariantSection({ variant }: { variant: BinderPlanVariant }) {
  const heading = `${variant.label.toUpperCase()} — ${variant.outTotal} out / ${variant.inTotal} in${
    variant.balanceNote !== undefined ? ` — ${variant.balanceNote}` : ""
  }`;

  return (
    <View style={styles.variant}>
      <Text style={styles.variantHeading}>{heading}</Text>
      <View style={styles.variantColumns}>
        <View style={styles.variantColumn}>
          <Text style={styles.variantColumnHeading}>OUT</Text>
          {variant.out.map((line) => (
            <Text key={line.name} style={styles.planLine}>
              {renderPlanLine(line, "-")}
            </Text>
          ))}
        </View>
        <View style={styles.variantColumn}>
          <Text style={styles.variantColumnHeading}>IN</Text>
          {variant.in.map((line) => (
            <Text key={line.name} style={styles.planLine}>
              {renderPlanLine(line, "+")}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function MatchupSection({ matchup }: { matchup: BinderMatchup }) {
  const priority = priorityLabel(matchup.priority);

  return (
    <View style={styles.matchup} wrap={false}>
      <View style={styles.matchupHeadingRow}>
        <Text style={styles.matchupHeading}>vs. {matchup.name}</Text>
        {priority !== undefined ? <Text style={styles.matchupPriority}>{priority}</Text> : null}
      </View>
      {matchup.isIncomplete ? <Text style={styles.incompleteFlag}>INCOMPLETE</Text> : null}
      <Text style={styles.sectionHeading}>GAME PLAN</Text>
      {plainTextLines(matchup.gamePlan).map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.gamePlanLine}>
          {line}
        </Text>
      ))}
      {matchup.variants.map((variant) => (
        <VariantSection key={variant.label} variant={variant} />
      ))}
    </View>
  );
}

export interface BinderPdfDocumentProps {
  readonly doc: BinderDocument;
}

export function BinderPdfDocument({ doc }: BinderPdfDocumentProps) {
  return (
    <Document title={doc.title}>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.body}>
          <Text style={styles.title}>{doc.title}</Text>
          <Text style={styles.subtitle}>Generated {doc.generatedAt.slice(0, 10)}</Text>

          <Text style={styles.sectionHeading}>DECK</Text>
          <View style={styles.deckColumns}>
            <DeckColumn
              heading={`Maindeck (${doc.deck.maindeckCount})`}
              lines={doc.deck.maindeck}
            />
            <DeckColumn
              heading={`Sideboard (${doc.deck.sideboardCount})`}
              lines={doc.deck.sideboard}
            />
          </View>

          {doc.matchups.map((matchup) => (
            <MatchupSection key={matchup.name} matchup={matchup} />
          ))}
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}  ·  ${doc.attribution}`
          }
        />
      </Page>
    </Document>
  );
}
