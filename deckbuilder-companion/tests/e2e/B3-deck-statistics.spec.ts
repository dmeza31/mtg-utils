/**
 * SPEC-B story B3 — deck statistics.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { DeckPage } from "../support/pages/DeckPage";
import { ImportPage } from "../support/pages/ImportPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

test("curve bars sum to the non-land maindeck count @mobile", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  const counts = await deckPage.curveBars.evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute("data-count"))),
  );
  const total = counts.reduce((sum, c) => sum + c, 0);

  // 60 maindeck minus the 19 lands in this fixture (4 Steam Vents, 4
  // Scalding Tarn, 3 Spirebluff Canal, 4 Island, 2 Mountain, 2 Fiery Islet).
  expect(total).toBe(60 - 19);
});

test("land count matches the land cards in the fixture", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  const landRow = deckPage.typeRows.filter({ hasText: "Land" });
  await expect(landRow).toHaveAttribute("data-count", "19");
});

test("pips are counted per copy — a 4x {U}{U} spell alone contributes 8 blue pips", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  // An isolated deck (just the 4x Counterspell plus enough lands to avoid
  // the FR-4.1 warning) keeps this test's arithmetic to one card's rule,
  // rather than summing every blue source in a realistic 60-card list.
  await importPage.pasteAndImport("4 Counterspell\n56 Island");
  await importPage.confirm();
  await deckPage.view.waitFor();

  const pip = page.locator('[data-testid="stat-pip-bar"][data-color="U"]');
  await expect(pip).toHaveAttribute("data-count", "8");
});

test("the hidden data table matches the visible curve bars (NFR-2.4)", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  const barData = await deckPage.curveBars.evaluateAll((els) =>
    els.map((el) => [el.getAttribute("data-mana-value"), el.getAttribute("data-count")]),
  );
  const tableRows = deckPage.statisticsPanel.locator("table").first().locator("tbody tr");
  const rowData = await tableRows.evaluateAll((rows) =>
    rows.map((row) => [...row.querySelectorAll("td")].map((td) => td.textContent)),
  );
  expect(rowData).toEqual(barData);
});

test("the statistics panel collapses on mobile and reopens @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  await expect(deckPage.statisticsContent).toBeVisible();
  await deckPage.statisticsToggle.click();
  await expect(deckPage.statisticsContent).toBeHidden();
  await deckPage.statisticsToggle.click();
  await expect(deckPage.statisticsContent).toBeVisible();
});
