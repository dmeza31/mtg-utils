/**
 * SPEC-A Task A-6 (NFR-6.6) — Zod schemas for every Scryfall response shape
 * this adapter touches. Scryfall is an external system; trusting its shape
 * at the TypeScript type level only is how a field going null at runtime
 * turns into a crash three layers away from the fetch call. `.passthrough()`
 * everywhere: we validate the fields we depend on, not the whole API shape,
 * so an unrelated field Scryfall adds later doesn't break validation.
 */
import { z } from "zod";

const ImageUrisSchema = z
  .object({
    small: z.string().optional(),
    normal: z.string().optional(),
    large: z.string().optional(),
  })
  .passthrough();

const CardFaceSchema = z
  .object({
    name: z.string(),
    mana_cost: z.string().optional(),
    type_line: z.string().optional(),
    oracle_text: z.string().optional(),
    image_uris: ImageUrisSchema.optional(),
  })
  .passthrough();

export const ScryfallCardSchema = z
  .object({
    object: z.literal("card"),
    id: z.string(),
    oracle_id: z.string(),
    name: z.string(),
    mana_cost: z.string().optional(),
    cmc: z.number(),
    type_line: z.string(),
    oracle_text: z.string().optional(),
    colors: z.array(z.string()).optional(),
    color_identity: z.array(z.string()),
    rarity: z.string(),
    set: z.string(),
    set_type: z.string(),
    collector_number: z.string(),
    layout: z.string(),
    released_at: z.string(),
    games: z.array(z.string()),
    digital: z.boolean(),
    image_uris: ImageUrisSchema.optional(),
    card_faces: z.array(CardFaceSchema).optional(),
  })
  .passthrough();

export type ScryfallCard = z.infer<typeof ScryfallCardSchema>;

const NotFoundIdentifierSchema = z.object({ name: z.string().optional() }).passthrough();

export const CollectionResponseSchema = z
  .object({
    object: z.literal("list"),
    not_found: z.array(NotFoundIdentifierSchema),
    data: z.array(ScryfallCardSchema),
  })
  .passthrough();

export type CollectionResponse = z.infer<typeof CollectionResponseSchema>;

export const SearchResponseSchema = z
  .object({
    object: z.literal("list"),
    data: z.array(ScryfallCardSchema),
    has_more: z.boolean(),
    next_page: z.string().optional(),
  })
  .passthrough();

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
