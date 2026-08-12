/**
 * SPEC-C — page object for the matchup sidebar + detail. Deferred from
 * earlier specs (SPEC-001 §8 deviation 7) until this surface existed.
 */
import type { Page } from "@playwright/test";

export class MatchupPage {
  constructor(private readonly page: Page) {}

  get sidebar() {
    return this.page.getByTestId("matchup-sidebar");
  }
  get list() {
    return this.page.getByTestId("matchup-list");
  }
  get items() {
    return this.page.getByTestId("matchup-item");
  }
  get addButton() {
    return this.page.getByTestId("matchup-add-button");
  }
  get addInput() {
    return this.page.getByTestId("matchup-add-input");
  }
  get addError() {
    return this.page.getByTestId("matchup-add-error");
  }
  get detail() {
    return this.page.getByTestId("matchup-detail");
  }
  get detailName() {
    return this.page.getByTestId("matchup-detail-name");
  }
  get detailStatus() {
    return this.page.getByTestId("matchup-detail-status");
  }
  get undoToast() {
    return this.page.getByTestId("matchup-undo-toast");
  }
  get undoButton() {
    return this.page.getByTestId("matchup-undo-button");
  }
  get opponentPanel() {
    return this.page.getByTestId("opponent-deck-panel");
  }
  get opponentToggle() {
    return this.page.getByTestId("opponent-deck-toggle");
  }

  itemByName(name: string) {
    return this.page.locator(`[data-testid="matchup-item"][data-matchup-name="${name}"]`);
  }

  statusOf(name: string) {
    return this.itemByName(name).getByTestId("matchup-status");
  }

  async addMatchup(name: string): Promise<void> {
    await this.addButton.click();
    await this.addInput.fill(name);
    await this.addInput.press("Enter");
  }

  async deleteMatchup(name: string): Promise<void> {
    const item = this.itemByName(name);
    await item.getByTestId("matchup-delete-button").click();
    await item.getByTestId("matchup-delete-confirm").click();
  }
}
