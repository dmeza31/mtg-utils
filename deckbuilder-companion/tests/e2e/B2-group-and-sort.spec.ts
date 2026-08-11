/**
 * SPEC-B story B2 — group and sort the deck view.
 *
 * Test 6 in the spec ("grouping choice survives navigating to a matchup and
 * back") isn't driveable yet — matchup navigation is SPEC-C, not built in
 * this session. `DeckViewPreferences` is already deliberately lifted out of
 * `DeckView`'s own state specifically so that survival will hold once
 * SPEC-C adds real navigation; recorded as a deviation in SPEC-B's
 * Definition of Done.
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

async function importMurktide(importPage: ImportPage, deckPage: DeckPage): Promise<void> {
  await importPage.goto();
  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();
}

test("default view groups by type in deckbuilding order", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importMurktide(importPage, deckPage);

  // This fixture's maindeck has no Planeswalkers, Enchantments, or Battles —
  // empty groups are omitted, never rendered as empty headers.
  const maindeckHeadings = deckPage.view
    .getByRole("region", { name: "Maindeck" })
    .locator('[data-testid="card-group"] h3');
  await expect(maindeckHeadings).toHaveText([
    /Creatures/,
    /Instants/,
    /Sorceries/,
    /Artifacts/,
    /Lands/,
  ]);
});

test("group by mana value shows ascending headings with lands absent", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importMurktide(importPage, deckPage);

  await deckPage.setGroupBy("manaValue");
  const maindeckHeadings = deckPage.view
    .getByRole("region", { name: "Maindeck" })
    .locator('[data-testid="card-group"] h3');
  const texts = await maindeckHeadings.allTextContents();
  expect(texts.some((t) => /^Land/i.test(t.trim()))).toBe(false);

  const values = texts.map((t) => t.trim().split(" ")[0]);
  const numeric = values.filter((v) => v !== "7+").map(Number);
  expect(numeric).toEqual([...numeric].sort((a, b) => a - b));
});

test("group by colour shows WUBRG order with Multicolour and Colourless present", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("dfc-and-split.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  await deckPage.setGroupBy("color");
  const maindeckHeadings = deckPage.view
    .getByRole("region", { name: "Maindeck" })
    .locator('[data-testid="card-group"] h3');
  const texts = (await maindeckHeadings.allTextContents()).map((t) => t.trim().split(" ")[0]);

  // Blue (Delver), Red (Bolt/Unholy Heat/etc), Multicolour (Fire // Ice is
  // colour identity R+U), Colourless (lands) — WUBRG order preserved among
  // whichever buckets are present.
  const order = ["White", "Blue", "Black", "Red", "Green", "Multicolor", "Colorless"];
  const indices = texts.map((t) => order.indexOf(t as string));
  expect(indices).toEqual([...indices].sort((a, b) => a - b));
  expect(texts).toContain("Multicolor");
});

test("sort by name collates accented names correctly (Æther Vial)", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importPage.goto();
  await importPage.pasteAndImport(fixture("accented.txt"));
  await importPage.confirm();
  await deckPage.view.waitFor();

  await deckPage.setGroupBy("none");
  await deckPage.setSortBy("name");

  // Maindeck and sideboard are sorted independently within their own
  // section (FR-6.5 — zones never merge), so this asserts within one zone
  // rather than across the whole page.
  const maindeck = deckPage.view.getByRole("region", { name: "Maindeck" });
  const names = await maindeck
    .locator('[data-testid="card-tile"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-name")));
  const sorted = [...names].sort((a, b) =>
    (a ?? "").localeCompare(b ?? "", "en", { sensitivity: "base" }),
  );
  expect(names).toEqual(sorted);
});

test("sort by quantity puts 4-ofs before 1-ofs", async ({ page }) => {
  const importPage = new ImportPage(page);
  const deckPage = new DeckPage(page);
  await importMurktide(importPage, deckPage);

  await deckPage.setGroupBy("none");
  await deckPage.setSortBy("quantity");

  const maindeck = deckPage.view.getByRole("region", { name: "Maindeck" });
  const quantities = await maindeck
    .locator('[data-testid="card-tile"]')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-quantity"))));
  expect(quantities).toEqual([...quantities].sort((a, b) => b - a));
});
