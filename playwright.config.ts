import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

/**
 * End-to-end and accessibility tests against the production build.
 * Spec files use the `.e2e.ts` suffix so Vitest does not pick them up.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    acceptDownloads: true,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    // The service worker would serve stale builds between runs.
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: { BASE_PATH: "/" },
  },
});
