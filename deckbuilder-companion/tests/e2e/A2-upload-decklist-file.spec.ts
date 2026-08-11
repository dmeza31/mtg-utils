/**
 * SPEC-A story A2 — upload or drag-and-drop a decklist file. `setInputFiles`
 * takes an in-memory `{name, mimeType, buffer}` payload for the oversized-file
 * case so a 2 MB binary never needs to live in the repo as a fixture.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { ImportPage } from "../support/pages/ImportPage";
import { expect, test } from "../support/fixtures";

function fixturePath(name: string): string {
  return path.join(process.cwd(), "tests/fixtures/decklists", name);
}

function fixtureText(name: string): string {
  return readFileSync(fixturePath(name), "utf8");
}

/**
 * Playwright has no native OS drag-and-drop for file drops; the standard
 * workaround is constructing a `DataTransfer` in-page and dispatching a real
 * `drop` event at it, which is what a browser's own DnD implementation does
 * under the hood.
 */
async function dropFile(
  page: Page,
  testId: string,
  fileName: string,
  content: string,
): Promise<void> {
  const dataTransfer = await page.evaluateHandle(
    ({ fileName, content }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([content], fileName, { type: "text/plain" }));
      return dt;
    },
    { fileName, content },
  );
  await page.getByTestId(testId).dispatchEvent("drop", { dataTransfer });
}

// See the comment in A1-paste-decklist.spec.ts — this guarantees every test
// in this file gets the mocked Scryfall routes, not the live API.
test.beforeEach(async ({ scryfall }) => {
  scryfall.reset();
});

test("uploading a .txt file produces the same result as pasting it", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.uploadAndImport(fixturePath("modern-izzet-murktide.txt"));

  await expect(importPage.maindeckCount).toHaveText("60");
  await expect(importPage.sideboardCount).toHaveText("15");
});

test("dragging a .txt file onto the drop zone produces the same result", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();

  await dropFile(page, "import-dropzone", "murktide.txt", fixtureText("modern-izzet-murktide.txt"));
  await importPage.submitButton.click();
  await importPage.parseSummary.waitFor();

  await expect(importPage.maindeckCount).toHaveText("60");
  await expect(importPage.sideboardCount).toHaveText("15");
});

test("a .dek XML fixture imports correctly (FR-1.3)", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();
  await importPage.uploadAndImport(fixturePath("mtgo-export.dek"));

  await expect(importPage.maindeckCount).toHaveText("24");
  await expect(importPage.sideboardCount).toHaveText("5");
  await expect(importPage.variant).toHaveText("MTGO .dek export");
});

test("a file over 1 MB is rejected with a clear message, no crash (NFR-5.4)", async ({ page }) => {
  const importPage = new ImportPage(page);
  await importPage.goto();

  const oversized = "4 Lightning Bolt\n".repeat(150_000); // well over 1 MB
  await importPage.fileInput.setInputFiles({
    name: "huge.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(oversized),
  });

  await expect(importPage.fileError).toBeVisible();
  await expect(importPage.fileError).toContainText("1 MB");
  // The screen is still usable — no crash, submit still reachable.
  await expect(importPage.submitButton).toBeVisible();
});
