/**
 * SPEC-A Task A-8 — implements the SPEC-002 `CardRepository` port,
 * composing `ScryfallClient` + `CardCache` + the printing policy.
 *
 * `resolve()`:
 * 1. Split requested names into cache hits (via an in-memory name→id index
 *    plus a warm `CardCache` entry) and misses.
 * 2. Phase 1 — `collection()` on the misses for canonical identity.
 * 3. Phase 2 — `searchPrints()` on the resolved names, grouped by
 *    `oracle_id`, oldest print selected per card (FR-2.13).
 * 4. FR-2.16 fallback — if phase 2 yields nothing for a card, keep phase
 *    1's default-printing images and mark `printingFallback: true`.
 * 5. Write everything to cache; return the `ResolveResult`.
 */
import type {
  CardNameQuery,
  CardRepository,
  ResolveResult,
  UnresolvedName,
} from "../../domain/ports/CardRepository";
import type { Card, CardId, CardImageUris } from "../../domain/model/types";
import { toCardId } from "../../domain/model/types";
import { selectOldestPrinting, type PrintingCandidate } from "../../domain/printing/policy";
import { ScryfallClient } from "./ScryfallClient";
import { CardCache } from "./CardCache";
import type { ScryfallCard } from "./schemas";

export interface ScryfallCardRepositoryOptions {
  readonly now?: () => number;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

type ScryfallImageUris = NonNullable<ScryfallCard["image_uris"]>;

function toImageUris(uris: ScryfallImageUris): CardImageUris {
  return {
    ...(uris.small !== undefined ? { small: uris.small } : {}),
    ...(uris.normal !== undefined ? { normal: uris.normal } : {}),
    ...(uris.large !== undefined ? { large: uris.large } : {}),
  };
}

function toPrintingCandidate(card: ScryfallCard): PrintingCandidate {
  return {
    id: card.id,
    set: card.set,
    setType: card.set_type,
    releasedAt: card.released_at,
    games: card.games,
    digital: card.digital,
    collectorNumber: card.collector_number,
    ...(card.image_uris !== undefined ? { imageUris: toImageUris(card.image_uris) } : {}),
  };
}

function dedupeByOracleId(cards: readonly ScryfallCard[]): ScryfallCard[] {
  const seen = new Map<string, ScryfallCard>();
  for (const card of cards) {
    if (!seen.has(card.oracle_id)) seen.set(card.oracle_id, card);
  }
  return [...seen.values()];
}

/**
 * FR-2.9 — identity's faces carry name/text; art comes from whichever
 * printing (oldest, or identity itself on FR-2.16 fallback) supplies it,
 * matched by face position.
 */
function buildFaces(identity: ScryfallCard, artSource: ScryfallCard): Card["faces"] | undefined {
  if (identity.card_faces === undefined) return undefined;
  return identity.card_faces.map((face, index) => {
    const artFace = artSource.card_faces?.[index];
    return {
      name: face.name,
      ...(face.mana_cost !== undefined ? { manaCost: face.mana_cost } : {}),
      ...(face.type_line !== undefined ? { typeLine: face.type_line } : {}),
      ...(face.oracle_text !== undefined ? { oracleText: face.oracle_text } : {}),
      ...(artFace?.image_uris !== undefined ? { imageUris: toImageUris(artFace.image_uris) } : {}),
    };
  });
}

function buildCard(
  identity: ScryfallCard,
  oldestFullCard: ScryfallCard | undefined,
  cachedAt: string,
): Card {
  const printingFallback = oldestFullCard === undefined;
  const artSource = oldestFullCard ?? identity;
  const faces = buildFaces(identity, artSource);

  return {
    oracleId: toCardId(identity.oracle_id),
    name: identity.name,
    ...(identity.mana_cost !== undefined ? { manaCost: identity.mana_cost } : {}),
    manaValue: identity.cmc,
    typeLine: identity.type_line,
    ...(identity.oracle_text !== undefined ? { oracleText: identity.oracle_text } : {}),
    colors: identity.colors ?? [],
    colorIdentity: identity.color_identity,
    rarity: identity.rarity,
    set: artSource.set,
    collectorNumber: artSource.collector_number,
    layout: identity.layout,
    ...(artSource.image_uris !== undefined ? { imageUris: toImageUris(artSource.image_uris) } : {}),
    ...(faces !== undefined ? { faces } : {}),
    cachedAt,
    ...(printingFallback ? { printingFallback: true } : {}),
  };
}

interface ResolvedMiss {
  readonly query: CardNameQuery;
  readonly identity: ScryfallCard;
}

export class ScryfallCardRepository implements CardRepository {
  private readonly nameIndex = new Map<string, CardId>();
  private readonly now: () => number;

  constructor(
    private readonly client: ScryfallClient,
    private readonly cache: CardCache,
    options: ScryfallCardRepositoryOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  async resolve(names: readonly CardNameQuery[]): Promise<ResolveResult> {
    const cards = new Map<CardId, Card>();
    const byQueriedName = new Map<string, CardId>();
    const unresolved: UnresolvedName[] = [];
    const misses: CardNameQuery[] = [];

    for (const query of names) {
      const cachedCard = this.cacheHitFor(query.name);
      if (cachedCard !== undefined) {
        cards.set(cachedCard.oracleId, cachedCard);
        byQueriedName.set(query.name, cachedCard.oracleId);
      } else {
        misses.push(query);
      }
    }

    if (misses.length === 0) {
      return { cards, byQueriedName, unresolved };
    }

    const collectionResult = await this.client.collection(misses.map((m) => ({ name: m.name })));
    const identityByName = indexByNameAndFrontFace(collectionResult.data);

    const resolvedMisses: ResolvedMiss[] = [];
    for (const query of misses) {
      const identity = identityByName.get(normalize(query.name));
      if (identity === undefined) {
        unresolved.push(await this.toUnresolved(query.name));
        continue;
      }
      resolvedMisses.push({ query, identity });
    }

    const uniqueIdentities = dedupeByOracleId(resolvedMisses.map((r) => r.identity));
    const printsByOracleId = await this.searchPrintsByOracleId(uniqueIdentities);

    const cachedAt = new Date(this.now()).toISOString();
    for (const identity of uniqueIdentities) {
      const printCards = printsByOracleId.get(identity.oracle_id) ?? [];
      const oldest = selectOldestPrinting(printCards.map(toPrintingCandidate));
      const oldestFullCard =
        oldest !== undefined ? printCards.find((c) => c.id === oldest.id) : undefined;

      const card = buildCard(identity, oldestFullCard, cachedAt);
      this.cache.set(card);
      cards.set(card.oracleId, card);
    }

    for (const { query, identity } of resolvedMisses) {
      const cardId = toCardId(identity.oracle_id);
      byQueriedName.set(query.name, cardId);
      this.nameIndex.set(normalize(query.name), cardId);
    }

    return { cards, byQueriedName, unresolved };
  }

  peek(cardId: CardId): Card | undefined {
    return this.cache.get(cardId);
  }

  async suggest(name: string): Promise<string | undefined> {
    try {
      const card = await this.client.namedFuzzy(name);
      return card?.name;
    } catch {
      // FR-2.10 — a failed suggestion lookup is not fatal; the caller just
      // gets no suggestion.
      return undefined;
    }
  }

  private cacheHitFor(name: string): Card | undefined {
    const cachedId = this.nameIndex.get(normalize(name));
    return cachedId !== undefined ? this.cache.get(cachedId) : undefined;
  }

  private async toUnresolved(name: string): Promise<UnresolvedName> {
    const suggestion = await this.suggest(name);
    return { name, reason: "not found", ...(suggestion !== undefined ? { suggestion } : {}) };
  }

  /** FR-2.16 — a phase 2 (search) failure never fails phase 1's identities. */
  private async searchPrintsByOracleId(
    identities: readonly ScryfallCard[],
  ): Promise<ReadonlyMap<string, ScryfallCard[]>> {
    if (identities.length === 0) return new Map();
    try {
      const printCards = await this.client.searchPrints(identities.map((c) => c.name));
      const byOracleId = new Map<string, ScryfallCard[]>();
      for (const printCard of printCards) {
        const list = byOracleId.get(printCard.oracle_id) ?? [];
        list.push(printCard);
        byOracleId.set(printCard.oracle_id, list);
      }
      return byOracleId;
    } catch {
      return new Map();
    }
  }
}

function indexByNameAndFrontFace(cards: readonly ScryfallCard[]): Map<string, ScryfallCard> {
  const index = new Map<string, ScryfallCard>();
  for (const card of cards) {
    index.set(normalize(card.name), card);
    const frontFace = card.name.split(" // ")[0];
    if (frontFace !== undefined) index.set(normalize(frontFace), card);
  }
  return index;
}
