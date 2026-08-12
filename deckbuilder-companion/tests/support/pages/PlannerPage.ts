/**
 * SPEC-D — page object for the sideboard planner (both interaction modes),
 * the validation bar, game plan editor, split play/draw controls, and the
 * post-board preview.
 */
import type { Locator, Page } from "@playwright/test";

export class PlannerPage {
  constructor(private readonly page: Page) {}

  get root() {
    return this.page.getByTestId("sideboard-planner");
  }
  get modeToggle() {
    return this.page.getByTestId("planner-mode-toggle");
  }
  get validationBar() {
    return this.page.getByTestId("plan-validation");
  }
  get outTotal() {
    return this.page.getByTestId("plan-out-total");
  }
  get inTotal() {
    return this.page.getByTestId("plan-in-total");
  }
  get postBoardSize() {
    return this.page.getByTestId("plan-postboard-size");
  }

  get dragPlanner() {
    return this.page.getByTestId("drag-planner");
  }
  get maindeckSource() {
    return this.page.getByTestId("plan-maindeck-source");
  }
  get sideboardSource() {
    return this.page.getByTestId("plan-sideboard-source");
  }
  get outZone() {
    return this.page.getByTestId("plan-out-zone");
  }
  get inZone() {
    return this.page.getByTestId("plan-in-zone");
  }
  get announcer() {
    return this.page.getByTestId("drag-planner-announcer");
  }

  get listPlanner() {
    return this.page.getByTestId("plan-list-planner");
  }
  get listSearch() {
    return this.page.getByTestId("plan-list-search");
  }
  get listTypeFilter() {
    return this.page.getByTestId("plan-list-type-filter");
  }
  get listRows() {
    return this.page.getByTestId("plan-list-row");
  }

  get splitToggle() {
    return this.page.getByTestId("split-play-draw-toggle");
  }
  get variantOnPlayTab() {
    return this.page.getByTestId("plan-variant-onplay");
  }
  get variantOnDrawTab() {
    return this.page.getByTestId("plan-variant-ondraw");
  }
  get copyVariantButton() {
    return this.page.getByTestId("plan-copy-variant");
  }

  get postBoardTrigger() {
    return this.page.getByTestId("post-board-preview-trigger");
  }
  get postBoardDialog() {
    return this.page.getByTestId("post-board-preview-dialog");
  }
  get postBoardCount() {
    return this.page.getByTestId("post-board-preview-count");
  }

  get undoButton() {
    return this.page.getByTestId("plan-undo-button");
  }
  get redoButton() {
    return this.page.getByTestId("plan-redo-button");
  }

  get gamePlanEditor() {
    return this.page.getByTestId("game-plan-editor");
  }
  get gamePlanPreviewToggle() {
    return this.page.getByTestId("game-plan-preview-toggle");
  }
  get gamePlanPreview() {
    return this.page.getByTestId("game-plan-preview");
  }

  async setMode(mode: "Drag" | "List"): Promise<void> {
    await this.modeToggle.getByText(mode, { exact: true }).click();
  }

  sourceCard(zone: Locator, cardName: string): Locator {
    return zone.locator(`[data-card-name="${cardName}"]`);
  }

  listRow(cardName: string): Locator {
    return this.page.locator(`[data-testid="plan-list-row"][data-card-name="${cardName}"]`);
  }
}
