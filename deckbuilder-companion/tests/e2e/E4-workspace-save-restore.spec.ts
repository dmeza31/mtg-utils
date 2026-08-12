/**
 * SPEC-E story E4 — workspace save/restore (FR-11.1–11.5). Test 3 is the
 * R-1 regression test and the single most valuable test in this spec: an
 * accidental refresh must never destroy an hour of sideboard planning.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { ExportDialogPage } from "../support/pages/ExportDialogPage";
import { ImportPage } from "../support/pages/ImportPage";
import { MatchupPage } from "../support/pages/MatchupPage";
import { PlannerPage } from "../support/pages/PlannerPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

function workspaceFixturePath(name: string): string {
  return path.join(process.cwd(), "tests/fixtures/workspaces", name);
}

test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

async function buildAPlan(
  page: Page,
): Promise<{ matchupPage: MatchupPage; plannerPage: PlannerPage; exportPage: ExportDialogPage }> {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const plannerPage = new PlannerPage(page);
  const exportPage = new ExportDialogPage(page);

  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();

  await matchupPage.addMatchup("Amulet Titan");
  await plannerPage.root.waitFor();
  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();
  const row = plannerPage.listRow("Lightning Bolt");
  await row.getByTestId("plan-list-increment").click();
  await row.getByTestId("plan-entry-note").fill("too slow");
  await page.getByTestId("game-plan-editor").fill("Race them.");

  return { matchupPage, plannerPage, exportPage };
}

test("exporting the workspace as JSON fires a download", async ({ page }) => {
  const { exportPage } = await buildAPlan(page);

  await exportPage.open();
  await exportPage.chooseFormat("workspace-json");
  await exportPage.workspaceJsonPreview.waitFor();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    exportPage.downloadButton.click(),
  ]);
  expect(download.suggestedFilename()).toBe("imported-deck-workspace.json");
});

test("importing a previously-exported JSON restores deck, matchups, plans and notes (FR-11.2)", async ({
  page,
}) => {
  const { exportPage } = await buildAPlan(page);
  await exportPage.open();
  await exportPage.chooseFormat("workspace-json");
  await exportPage.workspaceJsonPreview.waitFor();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    exportPage.downloadButton.click(),
  ]);
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  await exportPage.closeButton.click();

  // Simulate a fresh session with no autosaved workspace, reload to a clean
  // slate. Only the workspace key, not the card cache: card data re-resolves
  // from cache-or-Scryfall on load (§4 task E-6), and a cache-cold import is
  // a separate, documented limitation (see SPEC-E's Deviations) — this test
  // is about the JSON import path itself, not card re-resolution.
  await page.evaluate(() => localStorage.removeItem("dbc:workspace:v1"));
  await page.reload();
  await page.getByTestId("import-textarea").waitFor();
  await expect(page.getByTestId("restore-banner")).toHaveCount(0);

  await new ExportDialogPage(page).open();
  await page.getByTestId("import-workspace-file").setInputFiles(downloadedPath!);
  await page.getByTestId("deck-view").waitFor();

  await new MatchupPage(page).itemByName("Amulet Titan").click();
  await expect(page.getByTestId("game-plan-editor")).toHaveValue("Race them.");
  const plannerPage = new PlannerPage(page);
  await plannerPage.root.waitFor();
  await plannerPage.setMode("List");
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("1");
  await expect(plannerPage.listRow("Lightning Bolt").getByTestId("plan-entry-note")).toHaveValue(
    "too slow",
  );
});

test("reloading the page offers a restore, and accepting restores everything intact (FR-11.4, R-1)", async ({
  page,
}) => {
  const { plannerPage } = await buildAPlan(page);
  await page.waitForTimeout(2200); // let the ~1s autosave debounce flush

  await page.reload();
  await page.getByTestId("restore-banner").waitFor({ timeout: 10000 });
  await page.getByTestId("restore-accept").click();
  await page.getByTestId("deck-view").waitFor();

  await new MatchupPage(page).itemByName("Amulet Titan").click();
  await expect(page.getByTestId("game-plan-editor")).toHaveValue("Race them.");
  await plannerPage.root.waitFor();
  await plannerPage.setMode("List");
  await expect(
    plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-stepper-value"),
  ).toHaveValue("1");
});

test("declining the restore leaves a clean empty state and discards the saved data", async ({
  page,
}) => {
  await buildAPlan(page);
  await page.waitForTimeout(2200);

  await page.reload();
  await page.getByTestId("restore-banner").waitFor({ timeout: 10000 });
  await page.getByTestId("restore-decline").click();

  await expect(page.getByTestId("restore-banner")).toHaveCount(0);
  await expect(page.getByTestId("deck-view")).toHaveCount(0);

  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("restore-banner")).toHaveCount(0);
});

test("(NFR-4.4) importing a corrupt file shows a clear error and the app stays usable", async ({
  page,
}) => {
  const { exportPage } = await buildAPlan(page);
  await exportPage.open();

  await exportPage.importFileInput.setInputFiles(workspaceFixturePath("corrupt.json"));
  await exportPage.importError.waitFor();

  await expect(exportPage.importError).toBeVisible();
  await exportPage.closeButton.click();
  await expect(page.getByTestId("deck-view")).toBeVisible();
});

test("(FR-11.3) importing a future-version file shows a 'newer version' message, not a crash", async ({
  page,
}) => {
  const { exportPage } = await buildAPlan(page);
  await exportPage.open();

  await exportPage.importFileInput.setInputFiles(workspaceFixturePath("future-version.json"));
  await exportPage.importError.waitFor();

  await expect(exportPage.importError).toContainText(/newer version/i);
});

test("(FR-11.5) 'clear all local data' empties storage after confirmation", async ({ page }) => {
  const { exportPage } = await buildAPlan(page);
  await page.waitForTimeout(2200);

  await exportPage.open();
  await exportPage.clearLocalDataButton.click();
  await exportPage.clearLocalDataConfirm.click();
  await exportPage.closeButton.click();

  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("restore-banner")).toHaveCount(0);

  const remaining = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("dbc:")),
  );
  expect(remaining).toEqual([]);
});
