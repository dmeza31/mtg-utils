/**
 * SPEC-A Task A-4 — MTGO's `.dek` XML export. Each card is a self-closing
 * `<Cards Name="..." Quantity="..." Sideboard="true|false" />` element under
 * a `<Deck>` root. No DOM parser here (domain purity forbids one) — the
 * format is simple and fixed enough that a small regex extraction is more
 * honest than pulling in an XML library for five attributes.
 *
 * Malformed input (missing attributes, no `<Deck>` root) becomes a
 * `ParseProblem`, matching the text parser's "never throw past this
 * boundary" contract — normalises into the same `ParsedDecklist` so
 * everything downstream is unchanged.
 */
import { mergeEntries, type RawEntry } from "./mergeEntries";
import type { ParsedDecklist, ParseProblem } from "./parseDecklist";

const CARDS_ELEMENT = /<Cards\b([^>]*?)\/?>/g;
const ATTRIBUTE = /(\w+)="([^"]*)"/g;

function parseAttributes(attrText: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of attrText.matchAll(ATTRIBUTE)) {
    const [, key, value] = match;
    if (key !== undefined && value !== undefined) attrs.set(key, value);
  }
  return attrs;
}

export function parseDekXml(xml: string): ParsedDecklist {
  if (!/<Deck[\s>]/.test(xml)) {
    return {
      entries: [],
      problems: [
        {
          lineNumber: 1,
          raw: xml.slice(0, 80),
          reason: "malformed .dek XML — no <Deck> root element",
        },
      ],
      detectedVariant: "dekXml",
    };
  }

  const problems: ParseProblem[] = [];
  const raw: RawEntry[] = [];
  let index = 0;

  for (const match of xml.matchAll(CARDS_ELEMENT)) {
    index += 1;
    const attrText = match[1] ?? "";
    const attrs = parseAttributes(attrText);
    const name = attrs.get("Name");
    const quantityText = attrs.get("Quantity");
    const quantity = quantityText !== undefined ? Number.parseInt(quantityText, 10) : undefined;

    if (quantity === undefined || Number.isNaN(quantity) || quantity <= 0) {
      problems.push({
        lineNumber: index,
        raw: match[0],
        reason: "missing or invalid Quantity attribute",
      });
      continue;
    }
    if (name === undefined || name.trim() === "") {
      problems.push({ lineNumber: index, raw: match[0], reason: "missing Name attribute" });
      continue;
    }

    raw.push({
      name,
      quantity,
      zone: attrs.get("Sideboard") === "true" ? "sideboard" : "maindeck",
      sourceLine: index,
    });
  }

  return { entries: mergeEntries(raw), problems, detectedVariant: "dekXml" };
}
