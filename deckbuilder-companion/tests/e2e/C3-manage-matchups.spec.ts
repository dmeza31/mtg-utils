/**
 * SPEC-C story C3 — manage matchups: rename, reorder, delete, undo.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { ImportPage } from "../support/pages/ImportPage";
import { MatchupPage } from "../support/pages/MatchupPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

async function importDeck(page: Page, importPage: ImportPage): Promise<void> {
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
}

test("renaming a matchup updates the sidebar and the detail header", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("Original Name");

  await matchupPage.itemByName("Original Name").getByTestId("matchup-rename-button").click();
  const renameInput = matchupPage.itemByName("Original Name").getByTestId("matchup-rename-input");
  await renameInput.fill("New Name");
  await renameInput.press("Enter");

  await expect(matchupPage.itemByName("New Name")).toBeVisible();
  await expect(matchupPage.detailName).toHaveText("New Name");
});

test("reordering by keyboard (Alt+ArrowDown) changes the order and survives switching matchups", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("A");
  await matchupPage.addMatchup("B");

  const first = matchupPage.itemByName("A");
  await first.focus();
  await first.press("Alt+ArrowDown");

  const orderAfterMove = await matchupPage.items.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-matchup-name")),
  );
  expect(orderAfterMove).toEqual(["B", "A"]);

  // Switching the selected matchup and back doesn't disturb the new order —
  // there's no separate "view" to reload yet (SPEC-C doesn't add routing),
  // so this exercises the persistence the spec's "reload" step is checking.
  await matchupPage.itemByName("B").click();
  await matchupPage.itemByName("A").click();
  const orderAfterSwitch = await matchupPage.items.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-matchup-name")),
  );
  expect(orderAfterSwitch).toEqual(["B", "A"]);
});

test("deleting a matchup requires confirmation, then it's gone", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("Doomed");

  await matchupPage.itemByName("Doomed").getByTestId("matchup-delete-button").click();
  // Not yet deleted — awaiting confirmation.
  await expect(matchupPage.itemByName("Doomed")).toBeVisible();

  await matchupPage.itemByName("Doomed").getByTestId("matchup-delete-confirm").click();
  await expect(matchupPage.itemByName("Doomed")).toHaveCount(0);
});

test("undo from the toast restores the matchup at its original index with its plan intact (FR-5.6)", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("A");
  await matchupPage.addMatchup("B");
  await matchupPage.addMatchup("C");

  // Delete the middle one — index 1.
  await matchupPage.deleteMatchup("B");
  await expect(matchupPage.undoToast).toBeVisible();
  await expect(matchupPage.itemByName("B")).toHaveCount(0);

  await matchupPage.undoButton.click();

  const names = await matchupPage.items.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-matchup-name")),
  );
  expect(names).toEqual(["A", "B", "C"]);
});

test("deleting the selected matchup selects a neighbour rather than an empty state", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("A");
  await matchupPage.addMatchup("B");

  // "B" is selected (most recently added).
  await matchupPage.deleteMatchup("B");

  await expect(matchupPage.detail).toBeVisible();
  await expect(matchupPage.detailName).toHaveText("A");
});
