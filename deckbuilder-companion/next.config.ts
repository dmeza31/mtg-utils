import type { NextConfig } from "next";

/**
 * Content Security Policy — NFR-5.5.
 *
 * MAINTENANCE NOTE: a missing entry here presents as *silently broken images* or
 * a fetch that fails only in production, which is a confusing failure mode. If
 * Scryfall ever serves images from a host other than `cards.scryfall.io`, or the
 * API moves off `api.scryfall.com`, this list is the first place to look.
 *
 * - `img-src` needs `blob:` for the in-app PDF preview (FR-10.9) and `data:` for
 *   thumbnails embedded at export time (FR-10.11).
 * - `frame-src 'self' blob:` (SPEC-E) — `@react-pdf/renderer`'s `<PDFViewer>`
 *   (the in-app PDF preview, FR-10.9) renders into an `<iframe>` pointing at a
 *   `blob:` URL; without this it's silently blocked (no console-visible broken
 *   image, just a CSP frame-ancestors-style violation logged to console).
 * - `connect-src` is deliberately narrow: NFR-5.2 says the only outbound traffic
 *   is to Scryfall. `blob:` and `data:` are added (SPEC-E) for two purely local,
 *   no-network cases the wording still has to cover: the PDF preview iframe
 *   loading its own `blob:` document, and `fontkit` (a `@react-pdf/renderer`
 *   dependency) loading its WASM module from a `data:` URI. Neither leaves the
 *   browser. Widening beyond that means re-reading NFR-5.2 first.
 * - `script-src` allows 'unsafe-inline'/'unsafe-eval' because Next injects inline
 *   bootstrap scripts. Tightening this needs nonce-based middleware; tracked as
 *   post-v1 hardening rather than done half-way here.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cards.scryfall.io",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://api.scryfall.com",
  "frame-src 'self' blob:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
