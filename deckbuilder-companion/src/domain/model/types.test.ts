/**
 * SPEC-002 Task 1 (requirements §9, NFR-6.1). Type-level tests: these assert
 * nothing at runtime (`expectTypeOf` is a no-op call), they exist to make
 * `pnpm typecheck` fail if the model's readonly-ness or branding regresses.
 *
 * "Deeply readonly" is checked two ways rather than with one generic
 * recursive mapped type: a fully-generic `DeepReadonly<T>` recurses into
 * branded primitives (`CardId` structurally `extends object`) and blows past
 * TypeScript's instantiation budget on a model this size, silently widening
 * unrelated fields to `never`. Per-interface `Readonly<T>` catches a
 * reassignable property; explicit `readonly X[]` checks catch a mutable
 * array smuggled in behind a readonly property key — together they cover
 * every depth the model actually has.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  Card,
  CardFace,
  CardId,
  Deck,
  DeckEntry,
  Matchup,
  MatchupId,
  PlanEntry,
  SideboardPlan,
  Workspace,
} from "./types";
import { toCardId, toMatchupId } from "./types";

describe("domain model types (requirements §9)", () => {
  it("toCardId brands a raw oracle id at runtime as a no-op", () => {
    expect(toCardId("abc-123")).toBe("abc-123");
  });

  it("toMatchupId brands a raw id at runtime as a no-op", () => {
    expect(toMatchupId("xyz-789")).toBe("xyz-789");
  });

  it("CardId is a distinct brand, not assignable from a bare string", () => {
    expectTypeOf<string>().not.toExtend<CardId>();
  });

  it("MatchupId is a distinct brand, not assignable from a bare string", () => {
    expectTypeOf<string>().not.toExtend<MatchupId>();
  });

  it("CardId and MatchupId are not assignable to each other", () => {
    expectTypeOf<CardId>().not.toExtend<MatchupId>();
    expectTypeOf<MatchupId>().not.toExtend<CardId>();
  });

  describe("every model interface's own properties are readonly", () => {
    it("Workspace", () => {
      expectTypeOf<Workspace>().toEqualTypeOf<Readonly<Workspace>>();
    });
    it("Deck", () => {
      expectTypeOf<Deck>().toEqualTypeOf<Readonly<Deck>>();
    });
    it("DeckEntry", () => {
      expectTypeOf<DeckEntry>().toEqualTypeOf<Readonly<DeckEntry>>();
    });
    it("Card", () => {
      expectTypeOf<Card>().toEqualTypeOf<Readonly<Card>>();
    });
    it("CardFace", () => {
      expectTypeOf<CardFace>().toEqualTypeOf<Readonly<CardFace>>();
    });
    it("Matchup", () => {
      expectTypeOf<Matchup>().toEqualTypeOf<Readonly<Matchup>>();
    });
    it("PlanEntry", () => {
      expectTypeOf<PlanEntry>().toEqualTypeOf<Readonly<PlanEntry>>();
    });
    it("SideboardPlan", () => {
      expectTypeOf<SideboardPlan>().toEqualTypeOf<Readonly<SideboardPlan>>();
    });
  });

  describe("every array-valued field is a readonly array, not a mutable one", () => {
    it("Workspace.matchups", () => {
      expectTypeOf<Workspace["matchups"]>().toEqualTypeOf<readonly Matchup[]>();
    });
    it("Deck.maindeck and Deck.sideboard", () => {
      expectTypeOf<Deck["maindeck"]>().toEqualTypeOf<readonly DeckEntry[]>();
      expectTypeOf<Deck["sideboard"]>().toEqualTypeOf<readonly DeckEntry[]>();
    });
    it("Card.colors, Card.colorIdentity and Card.faces", () => {
      expectTypeOf<Card["colors"]>().toEqualTypeOf<readonly string[]>();
      expectTypeOf<Card["colorIdentity"]>().toEqualTypeOf<readonly string[]>();
      expectTypeOf<NonNullable<Card["faces"]>>().toEqualTypeOf<readonly CardFace[]>();
    });
    it("Matchup.tags", () => {
      expectTypeOf<Matchup["tags"]>().toEqualTypeOf<readonly string[]>();
    });
    it("SideboardPlan.out and SideboardPlan.in", () => {
      expectTypeOf<SideboardPlan["out"]>().toEqualTypeOf<readonly PlanEntry[]>();
      expectTypeOf<SideboardPlan["in"]>().toEqualTypeOf<readonly PlanEntry[]>();
    });
  });
});
