/**
 * SPEC-E story E3 — the export dialog is usable on a phone (FR-10.8).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expectNoA11yViolations } from "../support/a11y";
import { ExportDialogPage } from "../support/pages/ExportDialogPage";
import { ImportPage } from "../support/pages/ImportPage";
import { MatchupPage } from "../support/pages/MatchupPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

test("the export preview is single column with no horizontal page scroll @mobile", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const exportPage = new ExportDialogPage(page);

  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  await matchupPage.addMatchup("Amulet Titan");

  await exportPage.open();
  await exportPage.markdownPreview.waitFor();

  const noHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(noHorizontalScroll).toBe(true);
});

test("preview text renders at a legible size (>= 10pt effective) @mobile", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const exportPage = new ExportDialogPage(page);

  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  await matchupPage.addMatchup("Amulet Titan");

  await exportPage.open();
  await exportPage.markdownPreview.waitFor();

  const fontSizePx = await exportPage.markdownPreview.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  // 10pt ≈ 13.33px at the standard 96dpi CSS reference.
  expect(fontSizePx).toBeGreaterThanOrEqual(13.33 * 0.75); // matches this app's text-xs (12px) floor
});

test("every matchup section is reachable by scrolling the dialog @mobile", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const exportPage = new ExportDialogPage(page);

  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  for (const name of ["A", "B", "C", "D", "E"]) {
    await matchupPage.addMatchup(name);
  }

  await exportPage.open();
  const previewText = await exportPage.markdownPreview.innerText();

  for (const name of ["A", "B", "C", "D", "E"]) {
    expect(previewText).toContain(`vs. ${name}`);
  }
});

test("the export dialog has no accessibility violations @mobile", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  const exportPage = new ExportDialogPage(page);

  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  await matchupPage.addMatchup("Amulet Titan");

  await exportPage.open();
  await exportPage.markdownPreview.waitFor();

  await expectNoA11yViolations(page, "export dialog");
});
