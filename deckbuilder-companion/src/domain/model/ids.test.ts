/**
 * SPEC-002 Task 10. The generator is injected rather than calling
 * `crypto.randomUUID()` inline — deterministic ids are what make workspace
 * snapshot assertions (SPEC-E) possible at all.
 */
import { describe, expect, it } from "vitest";
import { createIdFactory } from "./ids";

function countingSource(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `id-${n}`;
  };
}

describe("createIdFactory", () => {
  it("next() delegates directly to the injected source", () => {
    const factory = createIdFactory(countingSource());

    expect(factory.next()).toBe("id-1");
    expect(factory.next()).toBe("id-2");
  });

  it("nextMatchupId() brands the injected source's output as a MatchupId", () => {
    const factory = createIdFactory(countingSource());

    expect(factory.nextMatchupId()).toBe("id-1");
  });

  it("is deterministic: the same source sequence always produces the same ids", () => {
    const a = createIdFactory(countingSource());
    const b = createIdFactory(countingSource());

    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });
});
