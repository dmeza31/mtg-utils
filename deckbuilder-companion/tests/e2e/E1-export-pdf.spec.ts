/**
 * SPEC-E story E1 — PDF export (FR-10.5–10.8, FR-10.12).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { downloadMatching, extractPdfText } from "../support/pdfDownload";
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

async function boardOut(plannerPage: PlannerPage, name: string, times = 1): Promise<void> {
  const row = plannerPage.listRow(name);
  for (let i = 0; i < times; i += 1) {
    await row.getByTestId("plan-list-increment").click();
  }
}

async function setUpThreeMatchups(
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
  await boardOut(plannerPage, "Lightning Bolt", 2);
  await plannerPage.listRow("Fiery Cannonade").getByTestId("plan-list-increment").click();
  await plannerPage.listRow("Fiery Cannonade").getByTestId("plan-list-increment").click();

  await matchupPage.addMatchup("Burn");
  await plannerPage.splitToggle.click();
  await plannerPage.variantOnPlayTab.waitFor();
  await boardOut(plannerPage, "Counterspell", 1);

  await matchupPage.addMatchup("Tron");
  await boardOut(plannerPage, "Consider", 3); // unbalanced: 3 out, 0 in

  return { matchupPage, plannerPage, exportPage };
}

test("exporting a PDF fires a download with the expected filename @cross-browser", async ({
  page,
}) => {
  const { exportPage } = await setUpThreeMatchups(page);
  await exportPage.open();
  await exportPage.chooseFormat("pdf");
  await exportPage.pdfPreview.waitFor({ timeout: 15000 });

  const download = await downloadMatching(page, "sideboard-binder", async () => {
    await exportPage.downloadButton.click();
  });

  expect(download.suggestedFilename()).toBe("imported-deck-sideboard-binder.pdf");
});

test("the PDF text contains the deck name, every matchup, OUT/IN cards and the attribution @cross-browser", async ({
  page,
}) => {
  const { exportPage } = await setUpThreeMatchups(page);
  await exportPage.open();
  await exportPage.chooseFormat("pdf");
  await exportPage.pdfPreview.waitFor({ timeout: 15000 });

  const download = await downloadMatching(page, "sideboard-binder", async () => {
    await exportPage.downloadButton.click();
  });
  const text = await extractPdfText(download);

  expect(text).toContain("Imported Deck");
  expect(text).toContain("Amulet Titan");
  expect(text).toContain("Burn");
  expect(text).toContain("Tron");
  expect(text).toContain("Lightning Bolt");
  expect(text).toContain("Fiery Cannonade");
  expect(text).toMatch(/Fan Content|Scryfall/);
});

test("(FR-10.3) a split play/draw matchup renders both labelled variants @cross-browser", async ({
  page,
}) => {
  const { exportPage } = await setUpThreeMatchups(page);
  await exportPage.open();
  await exportPage.chooseFormat("pdf");
  await exportPage.pdfPreview.waitFor({ timeout: 15000 });

  const download = await downloadMatching(page, "sideboard-binder", async () => {
    await exportPage.downloadButton.click();
  });
  const text = await extractPdfText(download);

  expect(text).toMatch(/ON THE PLAY/i);
  expect(text).toMatch(/ON THE DRAW/i);
});

test("(FR-7.6) an unbalanced plan exports with its incomplete marker @cross-browser", async ({
  page,
}) => {
  const { exportPage } = await setUpThreeMatchups(page);
  await exportPage.open();
  await exportPage.chooseFormat("pdf");
  await exportPage.pdfPreview.waitFor({ timeout: 15000 });

  const download = await downloadMatching(page, "sideboard-binder", async () => {
    await exportPage.downloadButton.click();
  });
  const text = await extractPdfText(download);

  expect(text).toMatch(/INCOMPLETE/);
  expect(text).toMatch(/Unbalanced/);
});

test("(FR-10.10) matchup selection limits the export to the chosen matchups @cross-browser", async ({
  page,
}) => {
  const { exportPage } = await setUpThreeMatchups(page);
  await exportPage.open();
  await exportPage.selectNone.click();
  await exportPage.matchupCheckbox("Amulet Titan").check();
  await exportPage.chooseFormat("pdf");
  await exportPage.pdfPreview.waitFor({ timeout: 15000 });

  const download = await downloadMatching(page, "sideboard-binder", async () => {
    await exportPage.downloadButton.click();
  });
  const text = await extractPdfText(download);

  expect(text).toContain("Amulet Titan");
  expect(text).not.toContain("Burn");
  expect(text).not.toContain("Tron");
});

test("(FR-10.12, NFR-4.1) export succeeds fully offline @cross-browser", async ({
  page,
  scryfall,
}) => {
  const { exportPage } = await setUpThreeMatchups(page);
  scryfall.offline();

  await exportPage.open();
  await exportPage.chooseFormat("pdf");
  await exportPage.pdfPreview.waitFor({ timeout: 15000 });

  const download = await downloadMatching(page, "sideboard-binder", async () => {
    await exportPage.downloadButton.click();
  });
  const text = await extractPdfText(download);

  expect(text).toContain("Imported Deck");
  expect(text).toContain("Amulet Titan");
});

test("(FR-10.11) thumbnails are off by default — the PDF stays small @cross-browser", async ({
  page,
}) => {
  const { exportPage } = await setUpThreeMatchups(page);
  await exportPage.open();
  await exportPage.chooseFormat("pdf");
  await exportPage.pdfPreview.waitFor({ timeout: 15000 });

  const download = await downloadMatching(page, "sideboard-binder", async () => {
    await exportPage.downloadButton.click();
  });
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const { statSync } = await import("node:fs");
  const sizeBytes = filePath !== null ? statSync(filePath).size : 0;

  expect(sizeBytes).toBeLessThan(200 * 1024);
});
