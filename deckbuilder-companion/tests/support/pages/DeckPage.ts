/**
 * SPEC-B — page object for the deck view. Deferred from earlier specs
 * (SPEC-001 §8 deviation 7) until this surface existed; built here
 * alongside the first specs that need it.
 */
import type { Page } from "@playwright/test";

export class DeckPage {
  constructor(private readonly page: Page) {}

  get view() {
    return this.page.getByTestId("deck-view");
  }
  get totals() {
    return this.page.getByTestId("deck-totals");
  }
  get tiles() {
    return this.page.getByTestId("card-tile");
  }
  get groups() {
    return this.page.getByTestId("card-group");
  }
  get groupHeadings() {
    return this.page.locator('[data-testid="card-group"] > h2, [data-testid="card-group"] > h3');
  }
  get groupBySelect() {
    return this.page.getByTestId("deck-group-by");
  }
  get sortBySelect() {
    return this.page.getByTestId("deck-sort-by");
  }
  get layoutSelect() {
    return this.page.getByTestId("deck-layout");
  }
  get sideboardSection() {
    return this.page.getByTestId("sideboard-section");
  }
  get statisticsPanel() {
    return this.page.getByTestId("statistics-panel");
  }
  get statisticsToggle() {
    return this.page.getByTestId("statistics-toggle");
  }
  get statisticsContent() {
    return this.page.getByTestId("statistics-content");
  }
  get curveBars() {
    return this.page.getByTestId("stat-curve-bar");
  }
  get pipBars() {
    return this.page.getByTestId("stat-pip-bar");
  }
  get typeRows() {
    return this.page.getByTestId("stat-type-row");
  }

  async setGroupBy(value: "type" | "manaValue" | "color" | "none"): Promise<void> {
    await this.groupBySelect.selectOption(value);
  }

  async setSortBy(value: "manaValue" | "name" | "quantity"): Promise<void> {
    await this.sortBySelect.selectOption(value);
  }
}
