/**
 * SPEC-E Task E-6 (FR-11.1–11.3). Versioned JSON serialisation for the
 * whole workspace — the format autosave (E-7) and manual export/import
 * both use.
 *
 * Card data is deliberately not serialised: only `CardId`s. That's what
 * keeps the file small and keeps it from ever going stale — cards
 * re-resolve from cache or Scryfall on load, not from this file.
 */
import { z } from "zod";
import type { Workspace } from "../model/types";

const CURRENT_SCHEMA_VERSION = 1;

const deckEntrySchema = z.object({
  cardId: z.string(),
  quantity: z.number().int().nonnegative(),
  listedPrinting: z.object({ set: z.string(), collectorNumber: z.string() }).optional(),
});

const formatSchema = z.enum([
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "pauper",
  "unknown",
]);

const deckSchema = z.object({
  id: z.string(),
  name: z.string(),
  format: formatSchema,
  maindeck: z.array(deckEntrySchema),
  sideboard: z.array(deckEntrySchema),
  importedAt: z.string(),
  sourceText: z.string(),
});

const planEntrySchema = z.object({
  cardId: z.string(),
  quantity: z.number().int().nonnegative(),
  note: z.string().optional(),
  broken: z.boolean().optional(),
});

const sideboardPlanSchema = z.object({
  out: z.array(planEntrySchema),
  in: z.array(planEntrySchema),
});

const matchupSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  tags: z.array(z.string()),
  opponentDeck: deckSchema.optional(),
  gamePlan: z.string(),
  splitPlayDraw: z.boolean(),
  plans: z.object({
    unified: sideboardPlanSchema.optional(),
    onPlay: sideboardPlanSchema.optional(),
    onDraw: sideboardPlanSchema.optional(),
  }),
});

/**
 * NFR-6.6 — the schema is the source of truth for what a v1 file may
 * contain. Not typed as `z.ZodType<Workspace>` directly: zod's `.optional()`
 * infers `T | undefined` (a required, possibly-undefined key), which
 * conflicts with `exactOptionalPropertyTypes`'s "absent or exactly T"
 * semantics for `Workspace`'s optional fields. A missing key never
 * survives as an explicit `undefined` value coming out of `JSON.parse` +
 * `safeParse`, so the cast in `deserializeWorkspace` reflects what's
 * actually true at runtime, not just at the type level.
 */
export const workspaceSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  deck: deckSchema.optional(),
  matchups: z.array(matchupSchema),
});

export function serializeWorkspace(ws: Workspace): string {
  return JSON.stringify(ws, null, 2);
}

export type WorkspaceError =
  | { readonly type: "invalid-json" }
  | { readonly type: "newer-version"; readonly foundVersion: number }
  | { readonly type: "invalid-schema"; readonly message: string };

export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/**
 * v1 -> current is the identity function; the seam exists so a v2 schema
 * doesn't have to invent one from scratch.
 */
function migrate(raw: unknown, fromVersion: number): unknown {
  void fromVersion;
  return raw;
}

const versionProbeSchema = z.object({ schemaVersion: z.number() });

export function deserializeWorkspace(json: string): Result<Workspace, WorkspaceError> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: { type: "invalid-json" } };
  }

  const probe = versionProbeSchema.safeParse(raw);
  if (!probe.success) {
    return {
      ok: false,
      error: { type: "invalid-schema", message: "Missing or invalid schemaVersion." },
    };
  }

  const { schemaVersion: foundVersion } = probe.data;
  if (foundVersion > CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: { type: "newer-version", foundVersion } };
  }

  const migrated = migrate(raw, foundVersion);
  const parsed = workspaceSchema.safeParse(migrated);
  if (!parsed.success) {
    return { ok: false, error: { type: "invalid-schema", message: parsed.error.message } };
  }

  return { ok: true, value: parsed.data as unknown as Workspace };
}
