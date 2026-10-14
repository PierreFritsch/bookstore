const { test, expect } = require("@playwright/test");

const BASE = process.env.CDS_URL ?? "http://localhost:4004";
const AUTH = Buffer.from("alice:").toString("base64");

test("Manage Authors list: first column is External ID, second column is Name, first row is BRONTC / Charlotte Brontë", async ({ page }) => {
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${AUTH}` });
  await page.goto(`${BASE}/$fiori-preview/AdminService/Authors#preview-app`);

  // Wait for the table to load data
  await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 30000 });

  // Column order: nth(0) is "Select All", content columns start at nth(1)
  const headers = page.getByRole("columnheader");
  await expect(headers.nth(1)).toHaveText("External ID", { exact: true });
  await expect(headers.nth(2)).toHaveText("Name", { exact: true });

  // First data row (sorted ascending by External ID): BRONTC
  // exact:true ensures bare ID — fails if ExternalID switches to TextFirst ("Charlotte Brontë (BRONTC)")
  const firstDataRow = page.getByRole("row").nth(1);
  const cells = firstDataRow.getByRole("gridcell");
  await expect(cells.nth(1)).toHaveText("BRONTC", { exact: true });
  await expect(cells.nth(2)).toHaveText("Charlotte Brontë", { exact: true });
});
