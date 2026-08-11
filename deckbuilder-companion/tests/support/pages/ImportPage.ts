/**
 * SPEC-A — page object for the import screen. Deferred from SPEC-001 (§8
 * deviation 7) until the DOM structure existed; built here alongside the
 * first spec that needs it.
 */
import type { Page } from "@playwright/test";

export class ImportPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  get textarea() {
    return this.page.getByTestId("import-textarea");
  }
  get fileInput() {
    return this.page.getByTestId("import-file-input");
  }
  get dropzone() {
    return this.page.getByTestId("import-dropzone");
  }
  get fileError() {
    return this.page.getByTestId("import-file-error");
  }
  get submitButton() {
    return this.page.getByTestId("import-submit");
  }
  get parseSummary() {
    return this.page.getByTestId("parse-summary");
  }
  get maindeckCount() {
    return this.page.getByTestId("parse-summary-maindeck-count");
  }
  get sideboardCount() {
    return this.page.getByTestId("parse-summary-sideboard-count");
  }
  get variant() {
    return this.page.getByTestId("parse-summary-variant");
  }
  get confirmButton() {
    return this.page.getByTestId("parse-summary-confirm");
  }
  get cancelButton() {
    return this.page.getByTestId("parse-summary-cancel");
  }
  get deckWarnings() {
    return this.page.getByTestId("deck-warning");
  }
  get unresolvedNames() {
    return this.page.getByTestId("unresolved-names");
  }
  get unresolvedNameItems() {
    return this.page.getByTestId("unresolved-name-item");
  }
  get reconciliationSummary() {
    return this.page.getByTestId("reconciliation-summary");
  }
  get reimportWarning() {
    return this.page.getByTestId("import-reimport-warning");
  }
  get errorMessage() {
    return this.page.getByTestId("parse-summary-error-message");
  }
  get retryButton() {
    return this.page.getByTestId("parse-summary-retry");
  }
  get dismissErrorButton() {
    return this.page.getByTestId("parse-summary-dismiss-error");
  }

  async pasteAndImport(text: string): Promise<void> {
    await this.textarea.fill(text);
    await this.submitButton.click();
    await this.parseSummary.waitFor();
  }

  async uploadAndImport(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await this.submitButton.click();
    await this.parseSummary.waitFor();
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }
}
