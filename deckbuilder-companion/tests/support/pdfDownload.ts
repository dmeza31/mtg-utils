/**
 * SPEC-E story E1 — PDF download helpers.
 *
 * `@react-pdf/renderer`'s `<PDFViewer>` (the in-app preview, FR-10.9) embeds
 * a `blob:` PDF in an iframe; Chromium's built-in PDF viewer fires its own
 * "download" events just from loading that blob, with a UUID filename, no
 * relation to the user's actual download click. Racing `waitForEvent` against
 * the click therefore sometimes catches the iframe's spurious event instead
 * of the real one — collecting every download and matching by filename is
 * the reliable alternative (reproduced by hand while building the dialog).
 */
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import type { Download, Page } from "@playwright/test";

export async function downloadMatching(
  page: Page,
  namePart: string,
  trigger: () => Promise<void>,
): Promise<Download> {
  const downloads: Download[] = [];
  const onDownload = (download: Download) => downloads.push(download);
  page.on("download", onDownload);
  try {
    await trigger();
    await page.waitForTimeout(1500);
  } finally {
    page.off("download", onDownload);
  }
  const match = downloads.find((d) => d.suggestedFilename().includes(namePart));
  if (match === undefined) {
    throw new Error(
      `no download matching "${namePart}" — saw: ${downloads.map((d) => d.suggestedFilename()).join(", ")}`,
    );
  }
  return match;
}

export async function extractPdfText(download: Download): Promise<string> {
  const path = await download.path();
  if (path === null) throw new Error("download has no local path");
  const data = await readFile(path);
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}
