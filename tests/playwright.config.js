// tests/playwright.config.js
//
// Dev-only test configuration. Not referenced by index.html or sw.js —
// has no effect on the deployed app or its load speed.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8917',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Serves the repo root (one level up from tests/) so /index.html and
    // /sw.js resolve exactly as they do on GitHub Pages.
    command: 'python3 -m http.server 8917 --directory ..',
    url: 'http://localhost:8917/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
