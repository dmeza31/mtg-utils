/**
 * SPEC-001 — test-harness smoke spec. Not tied to a user story (see
 * scripts/check-story-coverage.ts for the per-story requirement), just proof
 * that Playwright runs against the production build and the a11y helper
 * passes on the current placeholder page.
 */
import { test, expect } from "@playwright/test";
import { expectNoA11yViolations } from "../support/a11y";

test("home page loads with header, footer and legal disclaimer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("site-header")).toBeVisible();
  await expect(page.getByText("Deckbuilder Companion").first()).toBeVisible();
  const footer = page.getByTestId("legal-footer");
  await expect(footer).toBeVisible();
  await expect(footer).toContainText("Fan Content Policy");
});

test("home page has no automatically detectable a11y violations", async ({ page }) => {
  await page.goto("/");
  await expectNoA11yViolations(page, "home page placeholder");
});
