/**
 * SPEC-B story B4 — card detail (FR-3.7).
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

async function importDfcDeck(importPage: ImportPage, deckPage: DeckPage): Promise<void> {
  await importPage.goto();
  await importPage.pasteAndImport(fixture("dfc-and-split.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();
}

test("hovering a tile on desktop shows a popover with the large image and oracle text", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importDfcDeck(importPage, deckPage);

  const trigger = page.getByTestId("card-detail-trigger").first();
  await trigger.hover();
  const hovercard = page.getByTestId("card-detail-hovercard");
  await expect(hovercard).toBeVisible({ timeout: 3000 });
  await expect(hovercard.getByTestId("card-detail-oracle-text")).toBeVisible();
  await expect(hovercard.locator("img")).toBeVisible();
});

test("tapping a tile opens a modal dialog", async ({ page, browserName }) => {
  test.skip(browserName === "firefox", "touch emulation is chromium/webkit-only");
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importDfcDeck(importPage, deckPage);

  const trigger = page.getByTestId("card-detail-trigger").first();
  await trigger.click();
  await expect(page.getByTestId("card-detail-dialog")).toBeVisible();
});

test("Escape closes the dialog and focus returns to the originating tile", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importDfcDeck(importPage, deckPage);

  const trigger = page.getByTestId("card-detail-trigger").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("card-detail-dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("card-detail-dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("detail states the zone and quantity", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importDfcDeck(importPage, deckPage);

  // Murktide Regent is maindeck-only in this fixture (3 copies).
  const trigger = page.locator(
    '[data-testid="card-detail-trigger"]:has([data-card-name="Murktide Regent"])',
  );
  await trigger.click();
  const dialog = page.getByTestId("card-detail-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("card-detail-zones")).toContainText("Maindeck: 3");
  await expect(dialog.getByTestId("card-detail-zones")).not.toContainText("Sideboard");
});

test("a DFC's detail exposes both faces", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importDfcDeck(importPage, deckPage);

  const trigger = page.locator(
    '[data-testid="card-detail-trigger"]:has([data-card-name="Delver of Secrets // Insectile Aberration"])',
  );
  await trigger.click();
  const dialog = page.getByTestId("card-detail-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Delver of Secrets");

  const flip = dialog.getByTestId("card-detail-flip");
  await expect(flip).toContainText("Insectile Aberration");
  await flip.click();
  await expect(dialog).toContainText("Insectile Aberration");
  await expect(dialog.getByTestId("card-detail-flip")).toContainText("Delver of Secrets");
});

test("no automatically detectable a11y violations with the dialog open", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importDfcDeck(importPage, deckPage);

  const trigger = page.getByTestId("card-detail-trigger").first();
  await trigger.click();
  await expect(page.getByTestId("card-detail-dialog")).toBeVisible();

  await expectNoA11yViolations(page, "card detail dialog open");
});
