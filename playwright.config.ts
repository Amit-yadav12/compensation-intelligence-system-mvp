import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Run with:
 *   npx playwright install --with-deps chromium
 *   npm run build && npm run start        # production server on :3000
 *   npx playwright test
 *
 * The app must be connected to a seeded PostgreSQL database (see README).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
