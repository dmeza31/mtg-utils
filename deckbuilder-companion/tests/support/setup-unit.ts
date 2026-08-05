/**
 * SPEC-001 Task 1/4 — global setup for the `unit` and `dom` Vitest projects.
 *
 * `onUnhandledRequest: "error"` is deliberate: domain and adapter tests never
 * touch the network (SPEC-001 §6 rule 7). A test that reaches Scryfall
 * without an explicit mock should fail loudly, not silently pass against the
 * live API.
 */
import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";
import { scryfallHandlers } from "./scryfall-mock";

export const server = setupServer(...scryfallHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
