/**
 * SPEC-E — page object for the export dialog (binder Markdown/PDF, workspace
 * JSON, import, and "clear all local data").
 */
import type { Page } from "@playwright/test";

export class ExportDialogPage {
  constructor(private readonly page: Page) {}

  get trigger() {
    return this.page.getByTestId("export-dialog-trigger");
  }
  get dialog() {
    return this.page.getByTestId("export-dialog");
  }
  get closeButton() {
    return this.page.getByTestId("export-dialog-close");
  }
  get downloadButton() {
    return this.page.getByTestId("export-download");
  }
  get selectAll() {
    return this.page.getByTestId("export-select-all");
  }
  get selectNone() {
    return this.page.getByTestId("export-select-none");
  }
  get includeNotes() {
    return this.page.getByTestId("export-include-notes");
  }
  get matchupList() {
    return this.page.getByTestId("export-matchup-list");
  }
  get matchupCheckboxes() {
    return this.page.getByTestId("export-matchup-checkbox");
  }
  get markdownPreview() {
    return this.page.getByTestId("export-preview-markdown");
  }
  get pdfPreview() {
    return this.page.getByTestId("export-preview-pdf");
  }
  get workspaceJsonPreview() {
    return this.page.getByTestId("export-preview-workspace-json");
  }
  get importFileInput() {
    return this.page.getByTestId("import-workspace-file");
  }
  get importError() {
    return this.page.getByTestId("import-workspace-error");
  }
  get clearLocalDataButton() {
    return this.page.getByTestId("clear-local-data");
  }
  get clearLocalDataConfirm() {
    return this.page.getByTestId("clear-local-data-confirm");
  }

  async open(): Promise<void> {
    await this.trigger.click();
    await this.dialog.waitFor();
  }

  async chooseFormat(format: "markdown" | "pdf" | "workspace-json"): Promise<void> {
    await this.page.getByTestId(`export-format-${format}`).check();
  }

  matchupCheckbox(name: string) {
    return this.matchupList.locator(`label:has-text("${name}") input[type="checkbox"]`);
  }
}
