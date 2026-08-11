/**
 * SPEC-A story A1 — paste a decklist. Uses the shared `ScryfallMock`
 * (`tests/support/fixtures.ts`), whose collection fixture covers every
 * distinct real card name across `tests/fixtures/decklists/*.txt` (see
 * `scripts/refresh-scryfall-fixtures.ts`).
 *
 * `accented.txt` is intentionally not looped here: the mock does exact
 * lowercase string matching, and "Æther Vial" round-trips through live
 * Scryfall to canonical "Aether Vial" in a way the mock can't replicate
 * (recorded in SPEC-A's Definition of Done deviations).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expectNoA11yViolations } from "../support/a11y";
import { ImportPage } from "../support/pages/ImportPage";
import { expect, test } from "../support/fixtures";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "tests/fixtures/decklists", name), "utf8");
}

// The `scryfall` fixture is lazy — a test that never destructures it never
// installs the route mock, and silently falls through to the live API
// (flaky under parallel workers). Referencing it here in a file-wide
// `beforeEach` guarantees every test in this file is mocked.
test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

test("paste modern-izzet-murktide.txt shows 60/15, confirm commits the deck @cross-browser", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));

  await expect(importPage.maindeckCount).toHaveText("60");
  await expect(importPage.sideboardCount).toHaveText("15");

  await importPage.confirm();
  await expect(importPage.parseSummary).toHaveCount(0);
  await expect(importPage.reconciliationSummary).toBeVisible();
  await expect(importPage.reimportWarning).toBeVisible();
});

const variantFixtures = [
  { file: "arena-setcodes.txt", maindeck: 36, sideboard: 15 },
  { file: "dfc-and-split.txt", maindeck: 56, sideboard: 15 },
  { file: "header-sideboard.txt", maindeck: 58, sideboard: 15 },
  { file: "mtgo-blankline.txt", maindeck: 60, sideboard: 15 },
  { file: "quantity-x.txt", maindeck: 60, sideboard: 15 },
  { file: "workstation-sb-prefix.txt", maindeck: 58, sideboard: 15 },
];

for (const { file, maindeck, sideboard } of variantFixtures) {
  test(`imports ${file} (FR-1.7 variant) to maindeck ${maindeck} / sideboard ${sideboard}`, async ({
    page,
  }) => {
    const importPage = new ImportPage(page);
    await importPage.goto();
    await importPage.pasteAndImport(fixture(file));

    await expect(importPage.maindeckCount).toHaveText(String(maindeck));
    await expect(importPage.sideboardCount).toHaveText(String(sideboard));
  });
}

test("an undersized deck shows the FR-4.1 warning and still imports (FR-4.4)", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("undersized.txt"));

  await expect(importPage.deckWarnings.first()).toContainText("below the 60-card minimum");
  await importPage.confirm();
  await expect(importPage.reconciliationSummary).toBeVisible();
});

test("cold import completes within 3s against the mock (NFR-1.2)", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();

  const start = Date.now();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  expect(Date.now() - start).toBeLessThan(3000);
});

test("re-importing the same list makes zero further Scryfall requests (FR-2.6)", async ({
  page,
  scryfall,
}) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  const text = fixture("modern-izzet-murktide.txt");

  await importPage.pasteAndImport(text);
  await importPage.confirm();
  const collectionAfterFirst = scryfall.requestCount("collection");
  const searchAfterFirst = scryfall.requestCount("search");

  await importPage.pasteAndImport(text);
  expect(scryfall.requestCount("collection")).toBe(collectionAfterFirst);
  expect(scryfall.requestCount("search")).toBe(searchAfterFirst);
});

test("import screen has no automatically detectable a11y violations", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await expectNoA11yViolations(page, "import screen");
});
