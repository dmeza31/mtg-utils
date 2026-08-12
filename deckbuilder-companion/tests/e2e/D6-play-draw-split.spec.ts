/**
 * SPEC-D story D6 — the play/draw split (FR-6.8, FR-7.7).
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

test("enabling the split seeds both variants from the existing unified plan (FR-6.8)", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);

  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();

  await plannerPage.splitToggle.click();
  await plannerPage.variantOnPlayTab.waitFor();

  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("2");
  await plannerPage.variantOnDrawTab.click();
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("2");
});

test("editing on-the-draw leaves on-the-play unchanged", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await plannerPage.splitToggle.click();
  await plannerPage.variantOnDrawTab.click();

  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("2");

  await plannerPage.variantOnPlayTab.click();
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("1");
});

test("each variant validates independently (FR-7.7)", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.splitToggle.click();
  await plannerPage.variantOnPlayTab.waitFor();

  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await plannerPage.listRow("Fiery Cannonade").getByTestId("plan-list-increment").click();
  await expect(plannerPage.validationBar).toHaveAttribute("data-status", "balanced");

  await plannerPage.variantOnDrawTab.click();
  await expect(plannerPage.validationBar).toHaveAttribute("data-status", "empty");
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await expect(plannerPage.validationBar).toHaveAttribute("data-status", "unbalanced");
});

test("disabling the split prompts for which plan to keep and honours the choice", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.splitToggle.click();
  await plannerPage.variantOnDrawTab.click();
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();

  await plannerPage.splitToggle.click();
  const prompt = page.getByTestId("split-play-draw-keep-prompt");
  await prompt.waitFor();
  await page.getByTestId("split-keep-ondraw").click();

  await expect(prompt).toHaveCount(0);
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("3");
});

test("cancelling the keep-prompt leaves the split enabled", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.splitToggle.click();
  await plannerPage.variantOnPlayTab.waitFor();

  await plannerPage.splitToggle.click();
  await page.getByTestId("split-keep-cancel").click();

  await expect(plannerPage.splitToggle).toBeChecked();
  await expect(plannerPage.variantOnPlayTab).toBeVisible();
});
