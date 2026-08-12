/**
 * SPEC-E story E2 — Markdown export (FR-10.4, NFR-5.3).
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

test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

async function setUpMatchup(
  page: Page,
  matchupName: string,
): Promise<{ plannerPage: PlannerPage; exportPage: ExportDialogPage }> {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const plannerPage = new PlannerPage(page);
  const exportPage = new ExportDialogPage(page);

  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();

  await matchupPage.addMatchup(matchupName);
  await plannerPage.root.waitFor();
  await plannerPage.setMode("List");
  await plannerPage.listPlanner.waitFor();

  return { plannerPage, exportPage };
}

test("exporting Markdown fires a download whose content matches the preview structure", async ({
  page,
}) => {
  const { plannerPage, exportPage } = await setUpMatchup(page, "Amulet Titan");
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();
  await plannerPage.listRow("Fiery Cannonade").getByTestId("plan-list-increment").click();

  await exportPage.open();
  const previewText = await exportPage.markdownPreview.innerText();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    exportPage.downloadButton.click(),
  ]);
  expect(download.suggestedFilename()).toBe("imported-deck-sideboard-binder.md");

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const content = downloadPath !== null ? readFileSync(downloadPath, "utf8") : "";

  expect(content).toContain("Imported Deck");
  expect(content).toContain("Amulet Titan");
  expect(content).toContain("Lightning Bolt");
  expect(previewText).toContain("Amulet Titan");
  expect(previewText).toContain("Lightning Bolt");
});

test("(NFR-5.3) a matchup named 'Combo | Titan' does not corrupt the table", async ({ page }) => {
  const { exportPage } = await setUpMatchup(page, "Combo | Titan");

  await exportPage.open();
  const previewText = await exportPage.markdownPreview.innerText();

  expect(previewText).toContain("Combo");
  // The literal pipe must be escaped, not left to break the table structure —
  // every non-empty table row has the same delimiter count.
  const tableLines = previewText.split("\n").filter((line) => line.trimStart().startsWith("|"));
  if (tableLines.length > 0) {
    const counts = new Set(tableLines.map((line) => (line.match(/(?<!\\)\|/g) ?? []).length));
    expect(counts.size).toBe(1);
  }
});

test("game plan Markdown formatting is preserved in the export", async ({ page }) => {
  const { exportPage } = await setUpMatchup(page, "Amulet Titan");
  await page.getByTestId("game-plan-editor").fill("**Race them.** Board out slow cards.");
  await page.getByTestId("export-dialog-trigger").waitFor();

  await exportPage.open();
  const previewText = await exportPage.markdownPreview.innerText();

  expect(previewText).toContain("**Race them.**");
});

test("(FR-6.7) per-card notes appear in the export when included", async ({ page }) => {
  const { plannerPage, exportPage } = await setUpMatchup(page, "Amulet Titan");
  const row = plannerPage.listRow("Lightning Bolt");
  await row.getByTestId("plan-list-increment").click();
  await row.getByTestId("plan-entry-note").fill("vs removal");

  await exportPage.open();
  await expect(exportPage.includeNotes).toBeChecked();
  const previewText = await exportPage.markdownPreview.innerText();

  expect(previewText).toContain("vs removal");
});

test("the preview matches the downloaded file byte-for-byte", async ({ page }) => {
  const { plannerPage, exportPage } = await setUpMatchup(page, "Amulet Titan");
  await plannerPage.listRow("Lightning Bolt").getByTestId("plan-list-increment").click();

  await exportPage.open();
  const previewText = await exportPage.markdownPreview.innerText();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    exportPage.downloadButton.click(),
  ]);
  const downloadPath = await download.path();
  const content = downloadPath !== null ? readFileSync(downloadPath, "utf8") : "";

  expect(content).toBe(previewText);
});
