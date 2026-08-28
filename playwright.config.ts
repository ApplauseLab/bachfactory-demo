import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1920, height: 1080 },
    colorScheme: "dark",
    trace: process.env.E2E_TRACE === "1" ? "on" : "retain-on-failure",
    video: process.env.E2E_VIDEO === "1" ? "on" : "retain-on-failure",
  },
  outputDir: process.env.PLAYWRIGHT_VIDEO_SAVE_DIR ?? "artifacts/playwright",
  webServer: process.env.BASE_URL
    ? undefined
    : [
        {
          command: "bun dist/index.js",
          cwd: "apps/server",
          port: 33117,
          reuseExistingServer: true,
          env: {
            ...process.env,
            PORT: "33117",
            WEB_ORIGIN: "http://127.0.0.1:4173",
          },
        },
        {
          command: "bun run preview -- --host 127.0.0.1 --port 4173",
          cwd: "apps/web",
          port: 4173,
          reuseExistingServer: true,
          env: { ...process.env },
        },
      ],
});
