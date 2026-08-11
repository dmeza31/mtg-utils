/**
 * SPEC-A story A4 — re-import preserves plans.
 *
 * The full story (§6 of SPEC-A: create a matchup, build a 3-for-3 plan,
 * re-import a reduced list, assert the plan clamps and the matchup is
 * flagged) needs matchup-creation and plan-editing UI that don't exist yet
 * — those are SPEC-C and SPEC-D. Creating a matchup or a plan entry has no
 * driveable UI surface today, so this spec covers what's actually
 * reachable through the browser: the re-import flow and the reconciliation
 * summary rendering. The reconciliation *logic* itself (SPEC-002 task 8,
 * `reconcilePlan`) and its integration with `commitImport` (clamping,
 * `broken` flagging, untouched matchups producing no changes) are already
 * covered at the unit level in `src/domain/plan/reconcile.test.ts` and
 * `src/state/importDeck.test.ts`. Recorded as a deviation in SPEC-A's
 * Definition of Done — revisit once SPEC-C/D land.
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

test("re-importing over an existing deck warns first, then shows a reconciliation summary", async ({
  page,
}) => {
  const importPage = new ImportPage(page);
  await importPage.goto();

  await importPage.pasteAndImport(fixture("modern-izzet-murktide.txt"));
  await importPage.confirm();

  // No matchups exist yet (SPEC-C isn't built), so re-importing warns and
  // reconciliation is a no-op — but the summary still renders correctly.
  await expect(importPage.reimportWarning).toBeVisible();
  await importPage.pasteAndImport(fixture("header-sideboard.txt"));
  await importPage.confirm();

  await expect(importPage.reconciliationSummary).toBeVisible();
  await expect(importPage.reconciliationSummary).toContainText("unaffected");
  await expect(importPage.maindeckCount).toHaveCount(0); // parse-summary is gone; deck committed
});
