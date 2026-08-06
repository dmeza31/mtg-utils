/**
 * SPEC-002 Task 2 — in-memory `CardRepository` used by every later domain and
 * UI test instead of the network. `resolve` looks names up in an injected
 * catalog and populates the peek-cache as a real repository's resolve would;
 * `peek` only ever answers from that cache, never from the catalog directly,
 * so tests that call `peek` before `resolve` see the same "nothing cached
 * yet" behaviour a real cache would give.
 */
import type {
  CardNameQuery,
  CardRepository,
  ResolveResult,
  UnresolvedName,
} from "@/domain/ports/CardRepository";
import type { Card, CardId } from "@/domain/model/types";

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export class FakeCardRepository implements CardRepository {
  private readonly catalog: ReadonlyMap<string, Card>;
  private readonly suggestions: ReadonlyMap<string, string>;
  private readonly cache = new Map<CardId, Card>();

  constructor(catalog: readonly Card[] = [], suggestions: Readonly<Record<string, string>> = {}) {
    this.catalog = new Map(catalog.map((card) => [normalize(card.name), card]));
    this.suggestions = new Map(
      Object.entries(suggestions).map(([name, suggestion]) => [normalize(name), suggestion]),
    );
  }

  async resolve(names: readonly CardNameQuery[]): Promise<ResolveResult> {
    const cards = new Map<CardId, Card>();
    const byQueriedName = new Map<string, CardId>();
    const unresolved: UnresolvedName[] = [];

    for (const query of names) {
      const card = this.catalog.get(normalize(query.name));
      if (card === undefined) {
        const suggestion = this.suggestions.get(normalize(query.name));
        unresolved.push({
          name: query.name,
          reason: "not found",
          ...(suggestion !== undefined ? { suggestion } : {}),
        });
        continue;
      }
      cards.set(card.oracleId, card);
      byQueriedName.set(query.name, card.oracleId);
      this.cache.set(card.oracleId, card);
    }

    return { cards, byQueriedName, unresolved };
  }

  peek(cardId: CardId): Card | undefined {
    return this.cache.get(cardId);
  }

  async suggest(name: string): Promise<string | undefined> {
    return this.suggestions.get(normalize(name));
  }
}
