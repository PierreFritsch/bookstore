const { test, expect } = require("@playwright/test");
const { openAdaptFiltersDialog, getAvailableAddFilterOptions, assertP13nSortOptions, assertP13nColumns } = require("./fiori-test-helpers");

const BASE = process.env.CDS_URL ?? "http://localhost:4004";
const AUTH = Buffer.from("alice:").toString("base64");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${AUTH}` });
  await page.goto(`${BASE}/$fiori-preview/AdminService/Authors#preview-app`);
  await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 30000 });
});

test("Manage Authors Adapt Filters: External ID and Name are selected; Add Filter lists expected options", async ({ page }) => {
  // Open the Adapt Filters dialog
  const dialog = await openAdaptFiltersDialog(page, expect);

  // Assert External ID and Name are visible (selected) in the dialog
  // The filter rows are role="listitem"; visibility is indicated by the eye icon button
  // We check that both labels appear in the dialog list
  await expect(dialog.getByText("External ID", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(dialog.getByText("Name", { exact: true })).toBeVisible({ timeout: 5000 });

  // Read available options from the "Add Filter" dropdown
  const addFilterOptions = await getAvailableAddFilterOptions(page, dialog, expect);

  // Assert the available "Add Filter" options (order-insensitive)
  expect(addFilterOptions.sort()).toEqual(["Age", "Date of Birth", "Date of Death", "ID", "Lifetime", "Place of Birth", "Place of Death"]);
});

test("Manage Authors p13n dialog: Columns and Sort tabs list expected options", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  const p13nDialog = page.getByRole("dialog", { name: "View Settings" });
  await expect(p13nDialog).toBeVisible({ timeout: 10000 });

  await assertP13nColumns(
    p13nDialog,
    // selected (visible by default), in display order
    ["External ID", "Name", "Date of Birth", "Date of Death", "Place of Birth", "Place of Death"],
    // all columns (selected + opt-in), order-insensitive
    [
      "External ID",
      "Name",
      "Date of Birth",
      "Date of Death",
      "Place of Birth",
      "Place of Death",
      "Age",
      "Changed By",
      "Changed On",
      "Created By",
      "Created On",
      "ID",
      "Lifetime",
    ],
  );

  await assertP13nSortOptions(page, p13nDialog, [
    "Age",
    "Changed By",
    "Changed On",
    "Created By",
    "Created On",
    "Date of Birth",
    "Date of Death",
    "External ID",
    "Lifetime",
    "Name",
    "Place of Birth",
    "Place of Death",
  ]);

  await p13nDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(p13nDialog).toBeHidden({ timeout: 5000 });
});

test("Manage Authors list: first column is External ID, second column is Name, first row is BRONTC / Charlotte Brontë", async ({ page }) => {
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
