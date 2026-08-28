import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  workers: 1,
  outputDir: process.env.E2E_OUTPUT_DIR ?? "artifacts/e2e",
  reporter: process.env.E2E_DEMO_PACING === "1" ? "list" : undefined,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4173",
    viewport: { width: 1280, height: 720 },
    video: process.env.E2E_VIDEO === "1" ? "on" : "retain-on-failure",
    videoSize: { width: 1280, height: 720 },
    trace: process.env.E2E_TRACE === "1" ? "on" : "retain-on-failure",
    launchOptions: { slowMo: process.env.E2E_DEMO_PACING === "1" ? 40 : 0 },
  },
});
