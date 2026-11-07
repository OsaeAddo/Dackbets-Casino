import { defineConfig, devices } from '@playwright/test';

// A separate port keeps the suite from colliding with `npm run dev`.
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      // Use the full Chromium build in its new headless mode instead of the
      // separate chrome-headless-shell download.
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  // `npm run build` must have run first; the suite serves the production build
  // so the test exercises the same output shape that ships.
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
