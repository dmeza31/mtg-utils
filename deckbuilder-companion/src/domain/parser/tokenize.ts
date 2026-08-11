/**
 * SPEC-A Task A-1 — the line tokenizer. Pure and synchronous: it knows
 * nothing about card names, Scryfall, or deck legality (that's FR-4's job —
 * see the `999 Lightning Bolt` case below). `lineNumber` and `raw` are
 * carried on every token because story A3 needs to point at the exact
 * failing line, and threading them through later would touch every call
 * site.
 */

/** A printing hint from an MTGO/Arena-style `(SET) NUM` suffix (FR-1.7.6). */
export interface Printing {
  readonly set: string;
  readonly collectorNumber: string;
}

export type Line =
  | {
      readonly kind: "card";
      readonly quantity: number;
      readonly name: string;
      readonly printing?: Printing;
      readonly lineNumber: number;
      readonly raw: string;
    }
  | { readonly kind: "blank"; readonly lineNumber: number }
  | { readonly kind: "comment"; readonly lineNumber: number }
  | {
      readonly kind: "section";
      readonly section: "deck" | "sideboard";
      readonly lineNumber: number;
    }
  | {
      readonly kind: "unparseable";
      readonly reason: string;
      readonly lineNumber: number;
      readonly raw: string;
    };

const SB_PREFIX = /^SB:\s*/i;
const QUANTITY_PREFIX = /^(\d+)x?\s+(.+)$/i;
const PRINTING_SUFFIX = /^(.*?)\s*\(([A-Za-z0-9]{2,6})\)\s+([A-Za-z0-9]+★?)$/;
const HAS_LETTER = /\p{L}/u;

const SECTION_BY_HEADER: Record<string, "deck" | "sideboard"> = {
  deck: "deck",
  maindeck: "deck",
  sideboard: "sideboard",
};

function collapseWhitespace(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function extractPrinting(name: string): { name: string; printing?: Printing } {
  const match = PRINTING_SUFFIX.exec(name);
  if (!match) return { name };
  const [, bareName, set, collectorNumber] = match;
  if (!bareName || !set || !collectorNumber) return { name };
  return { name: bareName, printing: { set: set.toLowerCase(), collectorNumber } };
}

function tokenizeLine(raw: string, lineNumber: number): Line {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { kind: "blank", lineNumber };
  }

  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return { kind: "comment", lineNumber };
  }

  const headerKey = trimmed.replace(/:$/, "").toLowerCase();
  const section = SECTION_BY_HEADER[headerKey];
  if (section !== undefined) {
    return { kind: "section", section, lineNumber };
  }

  const withoutSbPrefix = trimmed.replace(SB_PREFIX, "");
  const quantityMatch = QUANTITY_PREFIX.exec(withoutSbPrefix);

  if (quantityMatch) {
    const [, quantityText, rest] = quantityMatch;
    const quantity = Number.parseInt(quantityText ?? "0", 10);
    if (quantity === 0) {
      return { kind: "unparseable", reason: "quantity must be greater than zero", lineNumber, raw };
    }
    const { name, printing } = extractPrinting(collapseWhitespace(rest ?? ""));
    return {
      kind: "card",
      quantity,
      name,
      ...(printing !== undefined ? { printing } : {}),
      lineNumber,
      raw,
    };
  }

  if (HAS_LETTER.test(withoutSbPrefix)) {
    const { name, printing } = extractPrinting(collapseWhitespace(withoutSbPrefix));
    return {
      kind: "card",
      quantity: 1,
      name,
      ...(printing !== undefined ? { printing } : {}),
      lineNumber,
      raw,
    };
  }

  return { kind: "unparseable", reason: "no card name found on this line", lineNumber, raw };
}

export function tokenizeLines(input: string): readonly Line[] {
  return input.split(/\r\n|\r|\n/).map((raw, index) => tokenizeLine(raw, index + 1));
}
