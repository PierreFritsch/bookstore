const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js',
  outputDir: '/tmp/playwright-bookstore',
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
