/**
 * SPEC-D story D3 ⭐ — mode-switch parity (FR-9.6). Task D-7 says there is
 * nothing to build here if §2's rule was followed: `DragPlanner` and
 * `ListPlanner` both read `matchup.plans[variant]` from the store and call
 * the same `actions.ts` functions, so this file is the test that proves it
 * — no mode-sync code exists anywhere in the SPEC-D diff.
 *
 * Test 3 substitutes a snapshot of every list-row quantity for "the
 * exported workspace JSON" the spec doc describes — JSON export doesn't
 * exist until SPEC-E, so a full plan snapshot serves the same purpose:
 * proving the round trip changed nothing.
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
  return plannerPage;
}

async function planSnapshot(page: Page, plannerPage: PlannerPage): Promise<string> {
  if (!(await plannerPage.listPlanner.isVisible())) {
    await plannerPage.setMode("List");
    await plannerPage.listPlanner.waitFor();
  }
  const rows = await plannerPage.listRows.evaluateAll((els) =>
    els
      .map((el) => [
        el.getAttribute("data-card-name"),
        (el.querySelector('[data-testid="plan-list-stepper-value"]') as HTMLInputElement | null)
          ?.value,
      ])
      .filter(([, value]) => value !== "0")
      .sort(([a], [b]) => (a ?? "").localeCompare(b ?? "")),
  );
  return JSON.stringify(rows);
}

test("a plan built in drag mode shows the same quantities after switching to list", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.setMode("Drag");
  await plannerPage.dragPlanner.waitFor();

  const boltSource = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");
  await boltSource.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("1");
});

test("a change made in list mode is reflected after switching back to drag", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();

  const row = plannerPage.listRow("Lightning Bolt");
  await row.getByTestId("plan-list-increment").click();
  await row.getByTestId("plan-list-increment").click();

  await plannerPage.setMode("Drag");
  await plannerPage.dragPlanner.waitFor();
  await expect(
    plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt").getByTestId("plan-card-subtitle"),
  ).toHaveText("2×");
});

test("round-tripping drag -> list -> drag with no change leaves the plan byte-identical", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.setMode("Drag");
  await plannerPage.dragPlanner.waitFor();

  const boltSource = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");
  await boltSource.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  const before = await planSnapshot(page, plannerPage);

  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();
  await plannerPage.setMode("Drag");
  await plannerPage.dragPlanner.waitFor();

  const after = await planSnapshot(page, plannerPage);
  expect(after).toBe(before);
});

test("switching modes mid-edit loses nothing", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();

  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await plannerPage.setMode("Drag");
  await plannerPage.dragPlanner.waitFor();
  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();
  await plannerPage.listRow("Fiery Cannonade").getByTestId("plan-list-increment").click();
  await plannerPage.setMode("Drag");
  await plannerPage.dragPlanner.waitFor();

  await expect(
    plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt").getByTestId("plan-card-subtitle"),
  ).toHaveText("1×");
  await expect(
    plannerPage.sourceCard(plannerPage.inZone, "Fiery Cannonade").getByTestId("plan-card-subtitle"),
  ).toHaveText("1×");
});
