/**
 * SPEC-002 Task 10. The generator is injected rather than calling
 * `crypto.randomUUID()` inline: tests need deterministic ids, and workspace
 * snapshot assertions (SPEC-E) are impossible if ids are random at
 * construction time.
 */
import { toMatchupId } from "./types";
import type { MatchupId } from "./types";

export interface IdFactory {
  next(): string;
  nextMatchupId(): MatchupId;
}

export function createIdFactory(source: () => string): IdFactory {
  return {
    next: source,
    nextMatchupId: () => toMatchupId(source()),
  };
}
