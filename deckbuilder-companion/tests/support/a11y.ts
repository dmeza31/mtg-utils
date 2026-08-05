/**
 * SPEC-001 Task 5 — a reusable accessibility assertion, called at the end of
 * every story E2E spec (NFR-2.1).
 *
 * Axe catches contrast, labelling and roles. It does NOT catch "can a
 * keyboard user actually complete this task" — that is why D1, D2 and D9
 * each get an explicit keyboard-only journey test in SPEC-D. This is a
 * floor, not a ceiling.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import type { Result } from "axe-core";

function formatViolations(violations: Result[], context?: string): string {
  if (violations.length === 0) return "";
  const label = context ? ` (${context})` : "";
  const lines = violations.map((violation) => {
    const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
    return `- [${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help} — ${targets}`;
  });
  return `${violations.length} accessibility violation(s)${label}:\n${lines.join("\n")}`;
}

export async function expectNoA11yViolations(page: Page, context?: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, formatViolations(results.violations, context)).toEqual([]);
}
