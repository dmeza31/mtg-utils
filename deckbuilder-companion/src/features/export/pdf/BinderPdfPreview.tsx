"use client";

/**
 * SPEC-E Task E-4 (FR-10.9). The lazy-loaded half of the PDF preview:
 * `next/dynamic(..., { ssr: false })` in `ExportDialog` is what keeps this
 * file — and the `@react-pdf/renderer` import it pulls in — out of the
 * initial bundle (NFR-1.5). Default export so `next/dynamic` can target it
 * directly.
 */
import { PDFViewer } from "@react-pdf/renderer";
import type { BinderDocument } from "@/domain/export/binder";
import { BinderPdfDocument } from "./BinderPdfDocument";

export default function BinderPdfPreview({ doc }: { doc: BinderDocument }) {
  return (
    <PDFViewer width="100%" height={480} showToolbar={false}>
      <BinderPdfDocument doc={doc} />
    </PDFViewer>
  );
}
