/**
 * SPEC-D story D7 — the post-board preview (FR-6.10).
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

async function setUpMatchup(page: Page): Promise<PlannerPage> {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const plannerPage = new PlannerPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  await matchupPage.addMatchup("Izzet Murktide");
  await plannerPage.root.waitFor();
  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();
  return plannerPage;
}

async function boardOut(plannerPage: PlannerPage, name: string, times = 1): Promise<void> {
  const row = plannerPage.listRow(name);
  for (let i = 0; i < times; i += 1) {
    await row.getByTestId("plan-list-increment").click();
  }
}

test("a 3-for-3 plan previews as 60 cards with the three swaps marked", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  await boardOut(plannerPage, "Lightning Bolt", 3);
  await boardOut(plannerPage, "Fiery Cannonade", 3);

  await plannerPage.postBoardTrigger.click();
  await plannerPage.postBoardDialog.waitFor();

  await expect(plannerPage.postBoardCount).toHaveText("60 cards");
  await expect(page.getByTestId("post-board-change-removed")).toContainText("3× Lightning Bolt");
  await expect(page.getByTestId("post-board-change-added")).toContainText("3× Fiery Cannonade");
});

test("boarding out all 4 copies of a maindeck card removes it from the maindeck preview entirely", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);
  await boardOut(plannerPage, "Lightning Bolt", 4);
  await boardOut(plannerPage, "Fiery Cannonade", 3);
  await boardOut(plannerPage, "Prismatic Ending", 1);

  await plannerPage.postBoardTrigger.click();
  await plannerPage.postBoardDialog.waitFor();

  // Lightning Bolt isn't gone — it moved to the sideboard section. "Removed
  // entirely" means out of the maindeck, not out of the 75.
  const maindeckSection = plannerPage.postBoardDialog.getByRole("region", { name: "Maindeck" });
  await expect(
    maindeckSection.locator('[data-testid="card-tile"][data-card-name="Lightning Bolt"]'),
  ).toHaveCount(0);
  const sideboardSection = plannerPage.postBoardDialog.getByTestId("sideboard-section");
  await expect(
    sideboardSection.locator('[data-testid="card-tile"][data-card-name="Lightning Bolt"]'),
  ).toHaveCount(1);
});

test("the preview reflects the currently selected variant when split is on", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.splitToggle.click();
  await plannerPage.variantOnPlayTab.waitFor();
  await boardOut(plannerPage, "Lightning Bolt", 2);
  await boardOut(plannerPage, "Fiery Cannonade", 2);

  await plannerPage.variantOnDrawTab.click();
  await boardOut(plannerPage, "Consider", 1);
  await boardOut(plannerPage, "Rest in Peace", 1);

  await plannerPage.postBoardTrigger.click();
  await plannerPage.postBoardDialog.waitFor();
  await expect(page.getByTestId("post-board-change-removed")).toContainText("1× Consider");
  await expect(page.getByTestId("post-board-change-removed")).not.toContainText("Lightning Bolt");
});
