import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  use: {
    baseURL: process.env.RANGA_TEST_BASE_URL ?? "http://127.0.0.1:3001",
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
    actionTimeout: 12000,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: [
    {
      command: "npm run service",
      url: "http://127.0.0.1:3003/api/health",
      reuseExistingServer: !process.env.CI,
      env: { RANGA_DATA_DIR: ".ranga-test-data/browser" },
    },
    {
      command: process.env.CI
        ? "npm run start -- --port 3001"
        : "npm run dev -- --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
