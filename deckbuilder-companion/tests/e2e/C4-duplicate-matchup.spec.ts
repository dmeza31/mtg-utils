/**
 * SPEC-C story C4 — duplicate a matchup. Test 2 is the reason this story
 * has its own spec file: a duplicate that shares a plan object with its
 * source is a data-loss bug that looks fine until the user edits it.
 *
 * The sideboard planner UI doesn't exist yet (SPEC-D), so "build a plan"
 * here means setting the game plan text and tags/priority (SPEC-C's own
 * editable matchup metadata) rather than an OUT/IN plan — enough to prove
 * duplication and the aliasing property without depending on SPEC-D.
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

test("duplicating a matchup produces '<name> (copy)' with the same game plan", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("Izzet Murktide");
  await page.getByTestId("game-plan-editor").fill("Race them.");

  await matchupPage.itemByName("Izzet Murktide").getByTestId("matchup-duplicate-button").click();

  await expect(matchupPage.itemByName("Izzet Murktide (copy)")).toBeVisible();
  await matchupPage.itemByName("Izzet Murktide (copy)").click();
  await expect(page.getByTestId("game-plan-editor")).toHaveValue("Race them.");
});

test("editing the copy's game plan leaves the source unchanged (the aliasing assertion)", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("Izzet Murktide");
  await page.getByTestId("game-plan-editor").fill("Original plan.");

  await matchupPage.itemByName("Izzet Murktide").getByTestId("matchup-duplicate-button").click();
  await matchupPage.itemByName("Izzet Murktide (copy)").click();
  await page.getByTestId("game-plan-editor").fill("Edited copy plan.");

  await matchupPage.itemByName("Izzet Murktide").click();
  await expect(page.getByTestId("game-plan-editor")).toHaveValue("Original plan.");
});

test("duplicating carries tags and priority across", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("Izzet Murktide");
  await page.getByTestId("matchup-priority").selectOption("high");
  await page.getByTestId("matchup-tag-input").fill("tempo");
  await page.getByTestId("matchup-tag-input").press("Enter");

  await matchupPage.itemByName("Izzet Murktide").getByTestId("matchup-duplicate-button").click();
  await matchupPage.itemByName("Izzet Murktide (copy)").click();

  await expect(page.getByTestId("matchup-priority")).toHaveValue("high");
  await expect(page.getByTestId("matchup-tags")).toContainText("tempo");
});
