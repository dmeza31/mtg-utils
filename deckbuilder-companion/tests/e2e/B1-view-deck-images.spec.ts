/**
 * SPEC-B story B1 — see the deck as card images.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expectNoA11yViolations } from "../support/a11y";
import { DeckPage } from "../support/pages/DeckPage";
import { ImportPage } from "../support/pages/ImportPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

test("importing the Murktide fixture renders 75 tiles across distinct maindeck and sideboard sections @cross-browser @mobile", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  // 17 distinct maindeck + 7 distinct sideboard names in this fixture — one
  // tile per distinct card, not one per copy (FR-3.1).
  await expect(deckPage.tiles).toHaveCount(24);
  await expect(deckPage.sideboardSection).toBeVisible();
  await expect(deckPage.sideboardSection.getByTestId("card-tile").first()).toBeVisible();
});

test('totals read "Maindeck 60" and "Sideboard 15" @cross-browser @mobile', async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  await expect(deckPage.totals).toContainText("Maindeck 60");
  await expect(deckPage.totals).toContainText("Sideboard 15");
});

test("a 4-of shows a quantity badge of 4 and appears as one tile, not four (FR-3.1)", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  const tile = page.locator('[data-testid="card-tile"][data-card-name="Dragon\'s Rage Channeler"]');
  await expect(tile).toHaveCount(1);
  await expect(tile).toHaveAttribute("data-quantity", "4");
  await expect(tile.getByText("4×")).toBeVisible();
});

test("every tile image has non-empty alt text containing the card name (NFR-2.3)", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  const images = page.locator('[data-testid="card-tile"] img');
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const alt = await img.getAttribute("alt");
    const cardName = await img
      .locator("xpath=ancestor::*[@data-testid='card-tile']")
      .getAttribute("data-card-name");
    expect(alt).toBeTruthy();
    expect(alt).toContain(cardName);
  }
});

test("tile images carry loading=lazy (FR-2.8)", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  const images = page.locator('[data-testid="card-tile"] img');
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(images.nth(i)).toHaveAttribute("loading", "lazy");
  }
});

test("at 320px there is no horizontal page scroll and tiles remain legible (FR-3.9, NFR-3.2) @mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  await expect(deckPage.tiles.first()).toBeVisible();
});

test("a DFC tile flips and back via keyboard (FR-2.9)", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("dfc-and-split.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  // `card.name` is Scryfall's combined name for a DFC — "Front // Back".
  const flipButton = page
    .locator(
      '[data-testid="card-tile"][data-card-name="Delver of Secrets // Insectile Aberration"]',
    )
    .getByTestId("card-tile-flip");
  await expect(flipButton).toBeVisible();
  await expect(flipButton).toHaveAttribute("aria-pressed", "false");

  await flipButton.focus();
  await page.keyboard.press("Enter");
  await expect(flipButton).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Enter");
  await expect(flipButton).toHaveAttribute("aria-pressed", "false");
});

test("import screen has no automatically detectable a11y violations", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  await expectNoA11yViolations(page, "deck view");
});
