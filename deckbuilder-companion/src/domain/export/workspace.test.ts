/**
 * SPEC-E Task E-6 (FR-11.1–11.3). `deserializeWorkspace` never throws — a
 * corrupt or unexpectedly-shaped file is exactly the kind of input a real
 * user will produce (a hand-edited file, a half-written download, a file
 * from a future version of the app) and a thrown exception here is a crash
 * on load, not a "welcome back" screen.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aDeck, aMatchup } from "../../../tests/support/builders";
import { toCardId, toMatchupId } from "../model/types";
import type { Workspace } from "../model/types";
import { deserializeWorkspace, serializeWorkspace } from "./workspace";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/workspaces", name), "utf8");
}

describe("serializeWorkspace / deserializeWorkspace round trip", () => {
  it("round-trips a full workspace (deck, matchups, plans, notes) to a deep-equal object", () => {
    const workspace: Workspace = {
      schemaVersion: 1,
      deck: aDeck(),
      matchups: [
        aMatchup({
          id: toMatchupId("m-1"),
          name: "Burn",
          priority: "high",
          tags: ["aggro"],
          gamePlan: "Race them.",
          splitPlayDraw: true,
          plans: {
            onPlay: {
              out: [{ cardId: toCardId("card-lightning-bolt"), quantity: 2, note: "too slow" }],
              in: [],
            },
            onDraw: { out: [], in: [] },
          },
        }),
      ],
    };

    const json = serializeWorkspace(workspace);
    const result = deserializeWorkspace(json);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(workspace);
    }
  });

  it("(FR-11.3) every serialized workspace carries schemaVersion", () => {
    const json = serializeWorkspace({ schemaVersion: 1, matchups: [] });
    const parsed = JSON.parse(json) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(1);
  });

  it("loads the valid-v1.json fixture", () => {
    const result = deserializeWorkspace(fixture("valid-v1.json"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matchups).toHaveLength(2);
      expect(result.value.deck?.name).toBe("Izzet Murktide");
    }
  });
});

describe("deserializeWorkspace error handling (NFR-4.4)", () => {
  it("a corrupt (unparseable) file returns an error, never throws", () => {
    expect(() => deserializeWorkspace(fixture("corrupt.json"))).not.toThrow();
    const result = deserializeWorkspace(fixture("corrupt.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("invalid-json");
    }
  });

  it("(FR-11.3) an unknown future schemaVersion returns a clear 'newer version' message, not a validation dump", () => {
    const result = deserializeWorkspace(fixture("future-version.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("newer-version");
      if (result.error.type === "newer-version") {
        expect(result.error.foundVersion).toBe(2);
      }
    }
  });

  it("a v1 file with extra unknown fields still loads (forward tolerance)", () => {
    const base = JSON.parse(fixture("valid-v1.json")) as Record<string, unknown>;
    const withExtra = {
      ...base,
      anUnknownFutureField: "some value",
      matchups: (base.matchups as Array<Record<string, unknown>>).map((m) => ({
        ...m,
        colorTag: "#3366ff",
      })),
    };

    const result = deserializeWorkspace(JSON.stringify(withExtra));

    expect(result.ok).toBe(true);
  });

  it("a structurally invalid v1 payload (wrong types) returns an error, never throws", () => {
    const invalid = JSON.stringify({ schemaVersion: 1, matchups: "not an array" });
    expect(() => deserializeWorkspace(invalid)).not.toThrow();
    const result = deserializeWorkspace(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("invalid-schema");
    }
  });

  it("non-JSON garbage input returns an error, never throws", () => {
    expect(() => deserializeWorkspace("not json at all {{{")).not.toThrow();
    expect(deserializeWorkspace("not json at all {{{").ok).toBe(false);
  });
});
