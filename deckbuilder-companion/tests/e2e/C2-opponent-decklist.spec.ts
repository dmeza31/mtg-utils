/**
 * SPEC-C story C2 — opponent decklist (FR-5.3, FR-5.8).
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

async function setUpMatchup(
  page: Page,
): Promise<{ importPage: ImportPage; matchupPage: MatchupPage }> {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await page.getByTestId("deck-view").waitFor();
  await matchupPage.addMatchup("Izzet Murktide");
  await matchupPage.opponentToggle.click();
  return { importPage, matchupPage };
}

test("pasting an opponent decklist renders its cards", async ({ page }) => {
  const { matchupPage } = await setUpMatchup(page);

  await page.getByTestId("opponent-import-textarea").fill(fixture("header-sideboard.txt"));
  await page.getByTestId("opponent-import-submit").click();
  await page.getByTestId("parse-summary").waitFor();
  await page.getByTestId("parse-summary-confirm").click();

  const opponentTiles = matchupPage.opponentPanel.getByTestId("card-tile");
  await expect(opponentTiles.first()).toBeVisible();
  await expect(matchupPage.opponentPanel.getByTestId("deck-totals")).toContainText("Maindeck 58");
});

test("the opponent deck stays visible while editing the game plan (FR-5.8)", async ({ page }) => {
  const { matchupPage } = await setUpMatchup(page);

  await page.getByTestId("opponent-import-textarea").fill(fixture("header-sideboard.txt"));
  await page.getByTestId("opponent-import-submit").click();
  await page.getByTestId("parse-summary").waitFor();
  await page.getByTestId("parse-summary-confirm").click();
  await expect(matchupPage.opponentPanel.getByTestId("deck-view")).toBeVisible();

  await page.getByTestId("matchup-game-plan").fill("Race them before they stabilize.");

  await expect(matchupPage.opponentPanel.getByTestId("deck-view")).toBeVisible();
});

test("a 62-card opponent list produces no deck-size warning (excluded from FR-4)", async ({
  page,
}) => {
  const { matchupPage } = await setUpMatchup(page);
  void matchupPage;

  // 4 Lightning Bolt + 58 Mountain = 62, comfortably legal, but the point of
  // this test is the exclusion, not this specific size — see the next test
  // for a size that WOULD warn on a workspace deck.
  await page.getByTestId("opponent-import-textarea").fill("4 Lightning Bolt\n58 Mountain");
  await page.getByTestId("opponent-import-submit").click();
  await page.getByTestId("parse-summary").waitFor();

  await expect(page.getByTestId("deck-warning")).toHaveCount(0);
});

test("an undersized opponent list (below 60) produces no warning either", async ({ page }) => {
  await setUpMatchup(page);

  await page.getByTestId("opponent-import-textarea").fill("4 Lightning Bolt\n26 Mountain");
  await page.getByTestId("opponent-import-submit").click();
  await page.getByTestId("parse-summary").waitFor();

  await expect(page.getByTestId("deck-warning")).toHaveCount(0);
});

test("removing the opponent deck clears the panel, matchup otherwise unchanged", async ({
  page,
}) => {
  const { matchupPage } = await setUpMatchup(page);

  await page.getByTestId("opponent-import-textarea").fill(fixture("header-sideboard.txt"));
  await page.getByTestId("opponent-import-submit").click();
  await page.getByTestId("parse-summary").waitFor();
  await page.getByTestId("parse-summary-confirm").click();
  await expect(page.getByTestId("opponent-deck-remove")).toBeVisible();

  await page.getByTestId("opponent-deck-remove").click();

  await expect(page.getByTestId("opponent-import-textarea")).toBeVisible();
  await expect(matchupPage.detailName).toHaveText("Izzet Murktide");
});
