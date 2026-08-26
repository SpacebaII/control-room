import { defineConfig, devices } from "@playwright/test";

const productionUrl = process.env.CONTROL_ROOM_URL;
const baseURL = productionUrl ?? "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: productionUrl ? undefined : {
    command: "npm run db:local && npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
