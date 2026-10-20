const { test, expect } = require("@playwright/test");

const BASE = process.env.CDS_URL ?? "http://localhost:4004";
const AUTH = Buffer.from("alice:").toString("base64");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${AUTH}` });
  await page.goto(`${BASE}/$fiori-preview/AdminService/Books#preview-app`);

  // Wait for the table to load data
  await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 30000 });
});

test('Manage Books list shows author in TextFirst format "Emily Brontë (BRONE)"', async ({ page }) => {
  // The author column uses @Common.Text: author.name and @Common.TextArrangement: #TextFirst
  // which renders as "Name (ID)" — e.g. "Emily Brontë (BRONE)"
  await expect(page.getByText("Emily Brontë (BRONE)", { exact: true })).toBeVisible();
});

test('Group by Author: group separator row shows author #TextFirst "Emily Brontë (BRONE)"', async ({ page }) => {
  // Open the p13n Settings dialog from the toolbar
  await page.getByRole("button", { name: "Settings" }).click();
  const p13nDialog = page.getByRole("dialog");
  await expect(p13nDialog).toBeVisible({ timeout: 10000 });

  // Switch to the "Group" tab
  await p13nDialog.getByRole("tab", { name: /Group/i }).click();

  // The Group By field is a sap.m.ComboBox. Use fill+Enter, which commits without needing the suggestion popover visible.
  const groupByCombo = p13nDialog.getByRole("combobox", { name: "Group By" });
  // fill() + Enter commits the ComboBox value without relying on the suggestion popover
  // being visible (which fill() alone doesn't trigger in headless mode)
  await groupByCombo.fill("External ID");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  // Confirm
  await p13nDialog.getByRole("button", { name: "OK" }).click();
  await expect(p13nDialog).toBeHidden({ timeout: 10000 });

  // The group separator row label includes the field name prefix: "External ID: Emily Brontë (BRONE)"
  // author_ID uses @Common.Text: author.name and @Common.TextArrangement: #TextFirst
  await expect(page.getByRole("row", { name: /External ID: Emily Brontë \(BRONE\)/ }).first()).toBeVisible({ timeout: 15000 });
});

test('Author column settings quick actions: Sort By shows "External ID" and "Name"', async ({ page }) => {
  // Click the "Author" column header label to open the Column Settings quick actions popover
  await page.getByRole("columnheader", { name: "Author" }).getByText("Author").click();

  // In UI5 ≥ 1.153 the popover carries aria-label="Column Settings"; in 1.142 it does not —
  // locate by heading text inside the dialog instead, which works across both versions.
  const columnSettings = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Column Settings" }) });
  await expect(columnSettings).toBeVisible({ timeout: 5000 });

  // The "Sort By" list should contain exactly "External ID" and "Name".
  // toHaveText on the collection checks count + content in one stable assertion,
  // avoiding a separate getByText pass that can race against list re-renders in CI.
  const sortByList = columnSettings.getByRole("list", { name: "Sort By" });
  await expect(sortByList.getByRole("listitem")).toHaveText(
    ["External ID", "Name"],
    { useInnerText: true, timeout: 10000 }
  );

  await columnSettings.getByRole("button", { name: "Close" }).click();
  await expect(columnSettings).toBeHidden({ timeout: 5000 });
});

test("Author value help: Show Filters has ExternalID+Name, table has ExternalID+Name columns, ExternalID bare, Name bare, token #TextFirst, Cancel", async ({ page }) => {
  // Wait for the filter bar to render (author_ID is in @UI.SelectionFields → textbox)
  const authorInput = page.getByRole("textbox", { name: /Author/i });
  await expect(authorInput).toBeVisible({ timeout: 30000 });

  // Open the Author value help dialog with F4
  await authorInput.click();
  await authorInput.press("F4");

  const vhDialog = page.getByRole("dialog", { name: /Author/i });
  await expect(vhDialog).toBeVisible({ timeout: 15000 });

  // Wait for at least one data row to be rendered (the heading "Items" and count "(4)" are
  // separate DOM nodes, but the grid has the combined accessible name "Items (4)")
  await expect(vhDialog.getByRole("grid", { name: /Items \(\d+\)/ })).toBeVisible({ timeout: 15000 });

  // ── VH table columns ──────────────────────────────────────────────────────
  // Authors entity: ID @Common: { TextArrangement: #TextSeparate } →
  // External ID column shows bare key, Name is a separate column
  const columnHeaders = vhDialog.getByRole("columnheader");
  await expect(columnHeaders.filter({ hasText: "External ID" })).toBeVisible({ timeout: 10000 });
  await expect(columnHeaders.filter({ hasText: "Name" })).toBeVisible({ timeout: 10000 });
  await expect(columnHeaders).toHaveCount(2);

  // ── Cell content: bare ID "BRONE", bare Name "Emily Bronte" ─────────────────
  // #TextSeparate means the ID cell shows only "BRONE" (not "Emily Brontë (BRONE)")
  // and the Name cell shows only "Emily Bronte" (not a combined value)
  await expect(vhDialog.getByRole("gridcell", { name: "BRONE", exact: true })).toBeVisible({ timeout: 10000 });
  await expect(vhDialog.getByRole("gridcell", { name: "Emily Brontë", exact: true })).toBeVisible({ timeout: 10000 });

  // ── Show Filters panel: exactly 2 filter inputs (ID and Name) ─────────────
  await vhDialog.getByRole("button", { name: "Show Filters" }).click();
  await expect(vhDialog.getByRole("textbox", { name: "External ID" })).toBeVisible({ timeout: 5000 });
  await expect(vhDialog.getByRole("textbox", { name: "Name" })).toBeVisible({ timeout: 5000 });
  await expect(vhDialog.getByRole("textbox")).toHaveCount(2);

  // ── Select Emily Brontë and verify #TextFirst token ───────────────────────
  // Search to reduce rows, then select via rowsel + Shift+Space
  await vhDialog.getByRole("searchbox").fill("Emily");
  await vhDialog.getByRole("button", { name: "Go" }).click();
  await expect(vhDialog.getByRole("grid", { name: "Items (1)" })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);

  const emilyRow = vhDialog.getByRole("row", { name: /Emily/ }).first();
  await expect(emilyRow).toBeVisible({ timeout: 5000 });

  // sap.ui.table blocks pointer events — focus rowsel via JS, then Shift+Space
  await emilyRow.evaluate((row) => {
    const owns = row.getAttribute("aria-owns") ?? "";
    const rowselId = owns.split(" ").find((id) => id.includes("-rowsel"));
    const el = rowselId ? document.getElementById(rowselId) : null;
    (el ?? document.getElementById(owns.split(" ")[0]))?.focus();
  });
  await page.bringToFront();
  await page.keyboard.press("Shift+ ");

  // Token in "Selected Items and Conditions" shows #TextFirst: "Emily Brontë (BRONE)"
  await expect(vhDialog.getByRole("option", { name: /Emily Brontë \(BRONE\)/ })).toBeVisible({ timeout: 5000 });

  // ── Cancel ────────────────────────────────────────────────────────────────
  await vhDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(vhDialog).toBeHidden({ timeout: 10000 });
});
