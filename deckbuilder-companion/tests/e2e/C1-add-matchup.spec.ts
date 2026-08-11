/**
 * SPEC-C story C1 — add a matchup.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expectNoA11yViolations } from "../support/a11y";
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

test("adding a matchup shows it in the sidebar, selected", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);

  await matchupPage.addMatchup("Izzet Murktide");

  await expect(matchupPage.itemByName("Izzet Murktide")).toBeVisible();
  await expect(matchupPage.itemByName("Izzet Murktide")).toHaveAttribute("data-selected", "true");
  await expect(matchupPage.detailName).toHaveText("Izzet Murktide");
});

test("a new matchup's status is empty", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);

  await matchupPage.addMatchup("Izzet Murktide");

  await expect(matchupPage.statusOf("Izzet Murktide")).toContainText("Empty");
  await expect(matchupPage.detailStatus).toContainText("Empty");
});

test("a whitespace-only name is rejected with a message (FR-5.2)", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);

  await matchupPage.addButton.click();
  await matchupPage.addInput.fill("   ");
  await matchupPage.addInput.press("Enter");

  await expect(matchupPage.addError).toBeVisible();
  await expect(matchupPage.items).toHaveCount(0);
});

test("adding five matchups lists all five in creation order", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);

  const names = ["Burn", "Control", "Midrange", "Tron", "Reanimator"];
  for (const name of names) {
    await matchupPage.addMatchup(name);
  }

  const listedNames = await matchupPage.items.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-matchup-name")),
  );
  expect(listedNames).toEqual(names);
});

test("no automatically detectable a11y violations", async ({ page }) => {
  const importPage = new ImportPage(page);
  const matchupPage = new MatchupPage(page);
  await importDeck(page, importPage);
  await matchupPage.addMatchup("Izzet Murktide");

  await expectNoA11yViolations(page, "matchup sidebar and detail");
});
