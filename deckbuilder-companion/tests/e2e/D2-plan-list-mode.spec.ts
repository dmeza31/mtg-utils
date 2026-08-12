/**
 * SPEC-D story D2 — list mode sideboard planning (FR-9.1–9.5).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/a11y";
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
  { switchToList = true }: { switchToList?: boolean } = {},
): Promise<PlannerPage> {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const plannerPage = new PlannerPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  await matchupPage.addMatchup("Izzet Murktide");
  await plannerPage.root.waitFor();
  if (switchToList) {
    await plannerPage.setMode("List");
    await plannerPage.listPlanner.waitFor();
  }
  return plannerPage;
}

test("switching to list mode renders maindeck and sideboard rows @mobile", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);

  await expect(plannerPage.listRow("Lightning Bolt")).toBeVisible();
  await expect(plannerPage.listRow("Fiery Cannonade")).toBeVisible();
});

test("+ on a maindeck row increments OUT and updates totals (FR-9.2) @mobile", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  const row = plannerPage.listRow("Lightning Bolt");

  await row.getByTestId("plan-list-increment").click();

  await expect(row.getByTestId("plan-list-stepper-value")).toHaveValue("1");
  await expect(plannerPage.outTotal).toHaveText("1 out");
});

test("+ is disabled at max copies, − disabled at 0 (FR-9.3, FR-7.4) @mobile", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  const row = plannerPage.listRow("Lightning Bolt");

  await expect(row.getByTestId("plan-list-decrement")).toBeDisabled();

  for (let i = 0; i < 4; i += 1) {
    await row.getByTestId("plan-list-increment").click();
  }

  await expect(row.getByTestId("plan-list-stepper-value")).toHaveValue("4");
  await expect(row.getByTestId("plan-list-increment")).toBeDisabled();
});

test("search filters rows; the type filter narrows further (FR-9.4) @mobile", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);

  await plannerPage.listSearch.fill("Lightning");
  await expect(plannerPage.listRow("Lightning Bolt")).toBeVisible();
  await expect(plannerPage.listRow("Counterspell")).toHaveCount(0);

  await plannerPage.listSearch.fill("");
  await plannerPage.listTypeFilter.selectOption("Land");
  await expect(plannerPage.listRow("Lightning Bolt")).toHaveCount(0);
  await expect(plannerPage.listRow("Island")).toBeVisible();
});

test("arrow keys adjust quantity from a focused row (FR-9.5) @mobile", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  const row = plannerPage.listRow("Lightning Bolt");

  await row.focus();
  await row.press("ArrowRight");
  await expect(row.getByTestId("plan-list-stepper-value")).toHaveValue("1");

  await row.press("ArrowLeft");
  await expect(row.getByTestId("plan-list-stepper-value")).toHaveValue("0");
});

test("list mode is the default below the tablet breakpoint (FR-9.7) @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const plannerPage = await setUpMatchup(page, { switchToList: false });
  await expect(plannerPage.listPlanner).toBeVisible();
});

test("the list planner has no accessibility violations @mobile", async ({ page }) => {
  await setUpMatchup(page);
  await expectNoA11yViolations(page, "list planner");
});
