import {
  FAN_CONTENT_DISCLAIMER,
  FAN_CONTENT_POLICY_URL,
  SCRYFALL_ATTRIBUTION,
  SCRYFALL_URL,
} from "@/domain/export/attribution";

/**
 * Legal attribution footer — NFR-7.1 and NFR-7.2.
 *
 * This is a legal requirement, not decoration, which is why it ships in
 * SPEC-000 before any feature exists: it cannot be forgotten later.
 *
 * It lives under `features/` rather than `components/` because it reads the
 * canonical attribution text from the domain, and the boundary rules allow
 * `features -> domain` but not `components -> domain`. That keeps the app and
 * the exported binder (FR-10.13) reading from one constant.
 */
export function LegalFooter() {
  return (
    <footer
      className="border-border text-muted-foreground mt-auto border-t text-xs"
      data-testid="legal-footer"
    >
      <div className="mx-auto max-w-7xl space-y-1 px-4 py-6 sm:px-6">
        <p>
          {FAN_CONTENT_DISCLAIMER}{" "}
          <a
            className="underline underline-offset-2"
            href={FAN_CONTENT_POLICY_URL}
            rel="noreferrer noopener"
            target="_blank"
          >
            Fan Content Policy
          </a>
        </p>
        <p>
          {SCRYFALL_ATTRIBUTION}{" "}
          <a
            className="underline underline-offset-2"
            href={SCRYFALL_URL}
            rel="noreferrer noopener"
            target="_blank"
          >
            scryfall.com
          </a>
        </p>
      </div>
    </footer>
  );
}
