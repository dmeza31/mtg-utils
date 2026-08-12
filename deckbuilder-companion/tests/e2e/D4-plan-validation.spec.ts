/**
 * SPEC-D story D4 — the validation bar (FR-7.1–7.6).
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

async function boardIn(plannerPage: PlannerPage, name: string, times = 1): Promise<void> {
  const row = plannerPage.listRow(name);
  for (let i = 0; i < times; i += 1) {
    await row.getByTestId("plan-list-increment").click();
  }
}

test("an empty plan shows 0 out, 0 in and an incomplete indicator @cross-browser", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);

  await expect(plannerPage.outTotal).toHaveText("0 out");
  await expect(plannerPage.inTotal).toHaveText("0 in");
  await expect(plannerPage.validationBar).toHaveAttribute("data-status", "empty");
});

test("3 out / 3 in is valid @cross-browser", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);

  await boardOut(plannerPage, "Lightning Bolt", 3);
  await boardIn(plannerPage, "Fiery Cannonade", 3);

  await expect(plannerPage.validationBar).toHaveAttribute("data-status", "balanced");
});

test('2 out / 3 in reads "2 out, 3 in — 1 too many" (FR-7.2, literal wording) @cross-browser', async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);

  await boardOut(plannerPage, "Lightning Bolt", 2);
  await boardIn(plannerPage, "Fiery Cannonade", 3);

  await expect(plannerPage.validationBar).toContainText("2 out, 3 in — 1 too many");
});

test("3 out / 2 in on a 60-card deck is unbalanced and under 60 post-board @cross-browser", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);

  await boardOut(plannerPage, "Lightning Bolt", 3);
  await boardIn(plannerPage, "Fiery Cannonade", 2);

  await expect(plannerPage.validationBar).toHaveAttribute("data-status", "unbalanced");
  await expect(plannerPage.postBoardSize).toHaveAttribute("data-under-minimum", "true");
  await expect(plannerPage.postBoardSize).toContainText("59 cards");
});

test("validation updates within one interaction, no reload (FR-7.5) @cross-browser", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);

  await expect(plannerPage.outTotal).toHaveText("0 out");
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await expect(plannerPage.outTotal).toHaveText("1 out");
});

test("an unbalanced plan stays fully editable — validation never blocks (FR-7.6) @cross-browser", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);

  await boardOut(plannerPage, "Lightning Bolt", 2);
  await expect(plannerPage.validationBar).toHaveAttribute("data-status", "unbalanced");

  // Still fully interactive — no dialog, no disabled state, blocking nothing.
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment"),
  ).toBeEnabled();
  await boardIn(plannerPage, "Fiery Cannonade", 1);
  await expect(plannerPage.inTotal).toHaveText("1 in");
});

test("the validation bar is a live region announced to screen readers @cross-browser", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);

  await expect(plannerPage.validationBar).toHaveAttribute("aria-live", "polite");
  await expect(plannerPage.validationBar).toHaveAttribute("role", "status");
});
