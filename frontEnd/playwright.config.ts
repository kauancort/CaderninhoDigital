import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  use: { baseURL: "http://127.0.0.1:3010", screenshot: "only-on-failure" },
  projects: [
    {
      name: "small-mobile",
      use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
    },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: "landscape",
      use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
    },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 3010 --strictPort",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: !process.env.CI,
  },
});
