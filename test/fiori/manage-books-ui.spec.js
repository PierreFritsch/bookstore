const { test, expect } = require('@playwright/test')

const BASE = process.env.CDS_URL ?? 'http://localhost:4004'
const AUTH = Buffer.from('alice:').toString('base64')

test('Manage Books list shows author in TextFirst format "Emily Brontë (101)"', async ({ page }) => {
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${AUTH}` })
  await page.goto(`${BASE}/$fiori-preview/AdminService/Books#preview-app`)

  // Wait for the table to load data (the responsive table uses role="row" for rows)
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 30000 })

  // The author column uses @Common.Text: author.name and @Common.TextArrangement: #TextFirst
  // which renders as "Name (ID)" — e.g. "Emily Brontë (101)"
  await expect(page.getByText('Emily Brontë (101)', { exact: true })).toBeVisible()
})
