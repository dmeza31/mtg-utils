/**
 * Canonical legal attribution text.
 *
 * Lives in the domain because it is part of the *exported document*, not just
 * chrome: NFR-7.5 requires exports to carry the same attribution the app shows,
 * and FR-10.13 makes it a mandatory element of the binder. One constant, so the
 * two can never drift.
 *
 * Requirements: NFR-7.1, NFR-7.2, NFR-7.5, FR-10.13
 */

export const APP_NAME = "Deckbuilder Companion";

/** NFR-7.2 — Wizards of the Coast Fan Content Policy disclaimer. */
export const FAN_CONTENT_DISCLAIMER =
  `${APP_NAME} is unofficial Fan Content permitted under the Fan Content Policy. ` +
  "Not approved or endorsed by Wizards. Portions of the materials used are " +
  "property of Wizards of the Coast. © Wizards of the Coast LLC.";

/** NFR-7.1 — Scryfall attribution. Scryfall is not affiliated with this project. */
export const SCRYFALL_ATTRIBUTION =
  "Card data and images courtesy of Scryfall. Scryfall is not affiliated with " +
  `${APP_NAME} and does not endorse it.`;

/** Single-string form used in exported Markdown and PDF footers (FR-10.13). */
export const EXPORT_ATTRIBUTION = `${FAN_CONTENT_DISCLAIMER} ${SCRYFALL_ATTRIBUTION}`;

export const FAN_CONTENT_POLICY_URL = "https://company.wizards.com/en/legal/fancontentpolicy";
export const SCRYFALL_URL = "https://scryfall.com";
