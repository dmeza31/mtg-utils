/**
 * SPEC-A story A3 — fix an unresolved card name without re-pasting.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImportPage } from "../support/pages/ImportPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

// See the comment in A1-paste-decklist.spec.ts — this guarantees every test
// in this file gets the mocked Scryfall routes, not the live API.
test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

test("the summary names the bad line and its line number", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("unresolvable.txt"));

  await expect(importPage.unresolvedNames).toBeVisible();
  const item = importPage.unresolvedNameItems.first();
  await expect(item).toContainText("Line 2");
  await expect(item).toContainText("Lightnin Bolt");
});

test('"Did you mean Lightning Bolt?" fixes the entry in place and the warning clears', async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("unresolvable.txt"));

  const maindeckBefore = await importPage.maindeckCount.textContent();

  await page.getByTestId("unresolved-name-suggestion").click();
  await importPage.parseSummary.waitFor();

  await expect(importPage.unresolvedNames).toHaveCount(0);
  const maindeckAfter = await importPage.maindeckCount.textContent();
  expect(Number(maindeckAfter)).toBe(Number(maindeckBefore) + 4); // the 4 corrected Lightning Bolts
});

test("import proceeds with the other cards intact even if the bad name is left unfixed", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("unresolvable.txt"));

  // 4 Monastery Swiftspear + 4 Goblin Guide + 4 Eidolon + 16 Mountain = 28
  // (the typo'd 4 Lightning Bolt is the only thing missing).
  await expect(importPage.maindeckCount).toHaveText("28");
  await expect(importPage.sideboardCount).toHaveText("4");

  await importPage.confirm();
  await expect(importPage.reconciliationSummary).toBeVisible();
});

test("a total resolution failure shows a clear error and a retry affordance, never a blank screen (NFR-4.2)", async ({
  page,
  scryfall,
}) => {
  scryfall.fail("collection");
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("unresolvable.txt"));

  await expect(importPage.errorMessage).toBeVisible();
  await expect(importPage.retryButton).toBeVisible();

  scryfall.reset();
  await importPage.retryButton.click();
  await importPage.parseSummary.waitFor();
  await expect(importPage.errorMessage).toHaveCount(0);
  await expect(importPage.maindeckCount).toHaveText("28");
});
