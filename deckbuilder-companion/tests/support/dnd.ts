/**
 * SPEC-D §8 — Playwright's `dragTo()` doesn't reliably cross dnd-kit's
 * pointer-sensor activation threshold (a discrete-pointer-event listener
 * with a movement threshold, not a native HTML5 drag). A stepped mouse
 * move does.
 */
import type { Locator, Page } from "@playwright/test";

export async function dragCardTo(page: Page, card: Locator, zone: Locator): Promise<void> {
  // `boundingBox()` doesn't auto-scroll (unlike click()/fill()), and the
  // planner sits below a full deck view — on a short viewport the card can
  // be well below the fold, so raw coordinates land outside the visible
  // viewport and the mouse events hit nothing.
  await card.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const to = await zone.boundingBox();
  if (from === null || to === null) throw new Error("element not visible");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / 10 + to.width / 2,
      from.y + ((to.y - from.y) * i) / 10 + to.height / 2,
    );
  }
  await page.mouse.up();
}
