"use client";

/**
 * SPEC-E bundle-size fix (NFR-1.5) — split out of `GamePlanEditor` so
 * `react-markdown` + `rehype-sanitize` load only when the user actually
 * opens the preview, via `next/dynamic` in the parent, rather than shipping
 * in the initial bundle for every page load. `rehype-sanitize` is what
 * makes `<script>` in a pasted game plan inert rather than executed
 * (NFR-5.3).
 */
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

export default function GamePlanPreview({ text }: { text: string }) {
  return (
    <div
      data-testid="game-plan-preview"
      className="border-border bg-muted/30 min-h-32 w-full rounded-md border p-2 text-sm [&_em]:italic [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
    >
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{text}</ReactMarkdown>
    </div>
  );
}
