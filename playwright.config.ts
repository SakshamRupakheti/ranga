import { defineConfig } from "@playwright/test";
const baseURL = process.env.RANGA_TEST_BASE_URL ?? "http://127.0.0.1:3001";
const webPort = new URL(baseURL).port || "3001";
const servicePort = process.env.RANGA_TEST_SERVICE_PORT ?? "3003";
const backendURL = `http://127.0.0.1:${servicePort}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  use: {
    baseURL,
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
      url: `${backendURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        RANGA_DATA_DIR: `.ranga-test-data/browser-${servicePort}`,
        RANGA_SERVICE_PORT: servicePort,
        RANGA_ORIGIN: baseURL,
      },
    },
    {
      command: process.env.CI
        ? `npm run start -- --port ${webPort}`
        : `npm run dev -- --port ${webPort}`,
      url: baseURL,
      env: { RANGA_BACKEND_URL: backendURL },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
