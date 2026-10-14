const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js',
  outputDir: '/tmp/playwright-bookstore',
  webServer: {
    command: 'cds watch --port 4004',
    url: 'http://localhost:4004',
    reuseExistingServer: true,
    timeout: 30000,
  },
  use: {
    headless: true,
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
