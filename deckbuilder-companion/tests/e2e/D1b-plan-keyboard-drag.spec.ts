/**
 * SPEC-D story D1 — the keyboard drag path (FR-8.6, NFR-2.2). Zone layout
 * is the §5 ASCII diagram (MAINDECK/OUT side-by-side, SIDEBOARD/IN
 * side-by-side below), so → moves a carried card from a source zone into
 * its paired drop zone and ← moves it back — see "Deviations from this
 * spec as written" for why this differs from the doc's "↓ to OUT" example.
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
  await plannerPage.setMode("Drag");
  return plannerPage;
}

test("Space picks up, arrow moves to OUT, Space drops — the plan updates (FR-8.6)", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);
  const card = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");

  await card.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  await expect(plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt")).toBeVisible();
});

test("the live region announces pick-up, the target zone, and the drop including totals (NFR-2.6)", async ({
  page,
}) => {
  const plannerPage = await setUpMatchup(page);
  const card = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");

  await card.focus();
  await page.keyboard.press("Space");
  await expect(plannerPage.announcer).toHaveText("Picked up Lightning Bolt");

  await page.keyboard.press("ArrowRight");
  await expect(plannerPage.announcer).toHaveText("Over OUT zone");

  await page.keyboard.press("Space");
  await expect(plannerPage.announcer).toHaveText("Dropped Lightning Bolt into OUT. 1 out, 0 in.");
});

test("Escape mid-drag cancels — the plan is unchanged", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);
  const card = plannerPage.sourceCard(plannerPage.maindeckSource, "Lightning Bolt");

  await card.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");

  await expect(plannerPage.sourceCard(plannerPage.outZone, "Lightning Bolt")).toHaveCount(0);
  await expect(card.getByTestId("plan-card-subtitle")).toHaveText("4 left");
});

test("a complete 3-for-3 plan is buildable using only the keyboard (NFR-2.2)", async ({ page }) => {
  const plannerPage = await setUpMatchup(page);

  const outCards = ["Lightning Bolt", "Spell Pierce", "Counterspell"];
  for (const name of outCards) {
    const card = plannerPage.sourceCard(plannerPage.maindeckSource, name);
    await card.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
  }

  const inCards = ["Fiery Cannonade", "Prismatic Ending", "Rest in Peace"];
  for (const name of inCards) {
    const card = plannerPage.sourceCard(plannerPage.sideboardSource, name);
    await card.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
  }

  for (const name of outCards) {
    await expect(plannerPage.sourceCard(plannerPage.outZone, name)).toBeVisible();
  }
  for (const name of inCards) {
    await expect(plannerPage.sourceCard(plannerPage.inZone, name)).toBeVisible();
  }
  await expect(plannerPage.outTotal).toHaveText("3 out");
  await expect(plannerPage.inTotal).toHaveText("3 in");
});
