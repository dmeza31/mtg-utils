import { defineConfig, devices } from "@playwright/test";

/**
 * SPEC-001 Task 2.
 *
 * Project usage (so the matrix doesn't become 19 story specs × 5 projects):
 * - chromium runs every story spec.
 * - firefox / webkit run only a tagged `@cross-browser` subset.
 * - mobile runs specs tagged `@mobile`.
 * - tablet runs only D1 (touch drag-and-drop, FR-8.7).
 *
 * Tests run against the PRODUCTION build (`pnpm build && pnpm start`), not
 * `next dev` — dev-mode timing and bundle behaviour differ enough to hide
 * real problems.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@cross-browser/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@cross-browser/ },
    { name: "mobile", use: { ...devices["iPhone 14"] }, grep: /@mobile/ },
    { name: "tablet", use: { ...devices["iPad Pro 11"] }, grep: /@tablet/ },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
