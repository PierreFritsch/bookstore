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

test('Author value help: Show Filters has ID+Name, table has ID+Name columns, ID bare, Name bare, token #TextFirst, Cancel', async ({ page }) => {
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${AUTH}` })
  await page.goto(`${BASE}/$fiori-preview/AdminService/Books#preview-app`)

  // Wait for the filter bar to render (author_ID is in @UI.SelectionFields → textbox)
  const authorInput = page.getByRole('textbox', { name: /Author/i })
  await expect(authorInput).toBeVisible({ timeout: 30000 })

  // Open the Author value help dialog with F4
  await authorInput.click()
  await page.waitForTimeout(200)
  await authorInput.press('F4')

  const vhDialog = page.getByRole('dialog', { name: /Author/i })
  await expect(vhDialog).toBeVisible({ timeout: 15000 })

  // Wait for at least one data row to be rendered
  await expect(vhDialog.getByRole('heading', { name: /Items \(\d+\)/ })).toBeVisible({ timeout: 15000 })

  // ── VH table columns ──────────────────────────────────────────────────────
  // Authors entity: ID @Common: { TextArrangement: #TextSeparate } →
  // ID column shows bare key, Name is a separate column
  const columnHeaders = vhDialog.getByRole('columnheader')
  await expect(columnHeaders.filter({ hasText: 'ID' })).toBeVisible({ timeout: 10000 })
  await expect(columnHeaders.filter({ hasText: 'Name' })).toBeVisible({ timeout: 10000 })
  await expect(columnHeaders).toHaveCount(2)

  // ── Cell content: bare ID "101", bare Name "Emily Bronte" ─────────────────
  // #TextSeparate means the ID cell shows only "101" (not "Emily Brontë (101)")
  // and the Name cell shows only "Emily Bronte" (not a combined value)
  await expect(vhDialog.getByRole('gridcell', { name: '101', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(vhDialog.getByRole('gridcell', { name: 'Emily Brontë', exact: true })).toBeVisible({ timeout: 10000 })

  // ── Show Filters panel: exactly 2 filter inputs (ID and Name) ─────────────
  await vhDialog.getByRole('button', { name: 'Show Filters' }).click()
  await expect(vhDialog.getByRole('textbox', { name: 'ID' })).toBeVisible({ timeout: 5000 })
  await expect(vhDialog.getByRole('textbox', { name: 'Name' })).toBeVisible({ timeout: 5000 })
  await expect(vhDialog.getByRole('textbox')).toHaveCount(2)

  // ── Select Emily Brontë and verify #TextFirst token ───────────────────────
  // Search to reduce rows, then select via rowsel + Shift+Space
  await vhDialog.getByRole('searchbox').fill('Emily')
  await vhDialog.getByRole('button', { name: 'Go' }).click()
  await expect(vhDialog.getByRole('heading', { name: 'Items (1)' })).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)

  const emilyRow = vhDialog.getByRole('row', { name: /Emily/ }).first()
  await expect(emilyRow).toBeVisible({ timeout: 5000 })

  // sap.ui.table blocks pointer events — focus rowsel via JS, then Shift+Space
  await emilyRow.evaluate((row) => {
    const owns = row.getAttribute('aria-owns') ?? ''
    const rowselId = owns.split(' ').find((id) => id.includes('-rowsel'))
    const el = rowselId ? document.getElementById(rowselId) : null;
    (el ?? document.getElementById(owns.split(' ')[0]))?.focus()
  })
  await page.bringToFront()
  await page.keyboard.press('Shift+ ')

  // Token in "Selected Items and Conditions" shows #TextFirst: "Emily Brontë (101)"
  await expect(vhDialog.getByRole('option', { name: /Emily Brontë \(101\)/ })).toBeVisible({ timeout: 5000 })

  // ── Cancel ────────────────────────────────────────────────────────────────
  await vhDialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(vhDialog).toBeHidden({ timeout: 10000 })
})
