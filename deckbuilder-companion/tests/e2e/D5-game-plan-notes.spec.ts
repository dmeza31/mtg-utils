/**
 * SPEC-D story D5 — the game plan editor (FR-6.6, NFR-5.3).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { ImportPage } from "../support/pages/ImportPage";
import { MatchupPage } from "../support/pages/MatchupPage";
import { PlannerPage } from "../support/pages/PlannerPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

async function setUpMatchup(
  page: Page,
): Promise<{ matchupPage: MatchupPage; plannerPage: PlannerPage }> {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const plannerPage = new PlannerPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  await matchupPage.addMatchup("Izzet Murktide");
  await plannerPage.root.waitFor();
  return { matchupPage, plannerPage };
}

test("a typed game plan persists across matchup navigation", async ({ page }) => {
  const { matchupPage, plannerPage } = await setUpMatchup(page);
  await matchupPage.addMatchup("Burn");

  await matchupPage.itemByName("Izzet Murktide").click();
  await plannerPage.gamePlanEditor.fill("Race them before they stabilize.");
  await matchupPage.itemByName("Burn").click();
  await matchupPage.itemByName("Izzet Murktide").click();

  await expect(plannerPage.gamePlanEditor).toHaveValue("Race them before they stabilize.");
});

test("the markdown preview renders bold, italic and bullets", async ({ page }) => {
  const { plannerPage } = await setUpMatchup(page);

  await plannerPage.gamePlanEditor.fill(
    "**Race** them, *carefully*.\n\n- board out slow cards\n- board in interaction",
  );
  await plannerPage.gamePlanPreviewToggle.click();
  await plannerPage.gamePlanPreview.waitFor();

  await expect(plannerPage.gamePlanPreview.locator("strong")).toHaveText("Race");
  await expect(plannerPage.gamePlanPreview.locator("em")).toHaveText("carefully");
  await expect(plannerPage.gamePlanPreview.locator("li")).toHaveCount(2);
});

test("a <script> tag in the game plan never executes (NFR-5.3)", async ({ page }) => {
  const { plannerPage } = await setUpMatchup(page);

  await plannerPage.gamePlanEditor.fill(
    "Race them.\n\n<script>window.__gamePlanXssRan = true;</script>\n\nBoard out slow cards.",
  );
  await plannerPage.gamePlanPreviewToggle.click();
  await plannerPage.gamePlanPreview.waitFor();

  const ran = await page.evaluate(
    () => (window as unknown as { __gamePlanXssRan?: boolean }).__gamePlanXssRan,
  );
  expect(ran).toBeUndefined();
  await expect(plannerPage.gamePlanPreview.locator("script")).toHaveCount(0);
  await expect(plannerPage.gamePlanPreview).toContainText("Race them.");
  await expect(plannerPage.gamePlanPreview).toContainText("Board out slow cards.");
});

test("5000 characters of game plan text doesn't break the layout", async ({ page }) => {
  const { plannerPage } = await setUpMatchup(page);
  const longText = "This matchup is close. ".repeat(210); // ~5040 chars

  await plannerPage.gamePlanEditor.fill(longText);

  const bodyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(bodyOverflow).toBe(true);
});
