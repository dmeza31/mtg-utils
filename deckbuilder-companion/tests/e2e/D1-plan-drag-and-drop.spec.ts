/**
 * SPEC-D story D1 — drag-and-drop sideboard planning (FR-8.x).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { dragCardTo } from "../support/dnd";
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
  await plannerPage.setMode("Drag");
  return { matchupPage, plannerPage };
}

test("dragging a maindeck card to OUT adds it and decrements the source count (FR-8.2, FR-8.5) @tablet", async ({
  page,
}) => {
  const { plannerPage } = await setUpMatchup(page);

  const source = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");
  await expect(source.getByTestId("plan-card-subtitle")).toHaveText("4 left");

  await dragCardTo(page, source, plannerPage.outZone);

  await expect(plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt")).toBeVisible();
  await expect(source.getByTestId("plan-card-subtitle")).toHaveText("3 left");
});

test("dragging a sideboard card to IN adds it (FR-8.2) @tablet", async ({ page }) => {
  const { plannerPage } = await setUpMatchup(page);

  const source = plannerPage.sourceCard(plannerPage.sideboardSource, "Fiery Cannonade");
  await dragCardTo(page, source, plannerPage.inZone);

  await expect(plannerPage.sourceCard(plannerPage.inZone, "Fiery Cannonade")).toBeVisible();
});

test("dragging a card out of OUT removes it and restores the source count (FR-8.3) @tablet", async ({
  page,
}) => {
  const { plannerPage } = await setUpMatchup(page);

  const source = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");
  await dragCardTo(page, source, plannerPage.outZone);
  const outCard = plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt");
  await expect(outCard).toBeVisible();

  await dragCardTo(page, outCard, plannerPage.maindeckSource);

  await expect(plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt")).toHaveCount(0);
  await expect(source.getByTestId("plan-card-subtitle")).toHaveText("4 left");
});

test("dragging a maindeck card to IN is rejected — the plan is unchanged (FR-8.4) @tablet", async ({
  page,
}) => {
  const { plannerPage } = await setUpMatchup(page);

  const source = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");
  await dragCardTo(page, source, plannerPage.inZone);

  await expect(plannerPage.sourceCard(plannerPage.inZone, "Lightning Bolt")).toHaveCount(0);
  await expect(plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt")).toHaveCount(0);
  await expect(source.getByTestId("plan-card-subtitle")).toHaveText("4 left");
});

test("a fully-boarded-out 4-of is no longer draggable (FR-7.4) @tablet", async ({ page }) => {
  const { plannerPage } = await setUpMatchup(page);
  const source = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");

  for (let i = 0; i < 4; i += 1) {
    await dragCardTo(page, source, plannerPage.outZone);
  }

  await expect(source.getByTestId("plan-card-subtitle")).toHaveText("0 left");
  await expect(source).toBeDisabled();
});

test("touch drag moves a card between zones on the tablet project (FR-8.7) @tablet", async ({
  page,
}) => {
  const { plannerPage } = await setUpMatchup(page);

  const source = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");
  await dragCardTo(page, source, plannerPage.outZone);

  await expect(plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt")).toBeVisible();
});

test("the drag planner has no accessibility violations @tablet", async ({ page }) => {
  await setUpMatchup(page);
  await expectNoA11yViolations(page, "drag planner");
});
