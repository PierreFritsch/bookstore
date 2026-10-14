const { expect } = require("@playwright/test");

/**
 * Clicks "Adapt Filters", waits for the dialog to appear, and returns its locator.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function openAdaptFiltersDialog(page, expect) {
  await page.getByRole("button", { name: "Adapt Filters" }).click();
  const dialog = page.getByRole("dialog", { name: "Adapt Filters" });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return dialog;
}

/**
 * Returns the sorted list of options available in the "Add Filter" dropdown
 * of an Adapt Filters dialog (works with both sap.m.Select and sap.m.ComboBox).
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} dialog  - the "Adapt Filters" dialog locator
 * @param {import('@playwright/test').Expect} expect
 * @returns {Promise<string[]>} trimmed, non-empty option texts
 */
async function getAvailableAddFilterOptions(page, dialog, expect) {
  const kind = await dialog.evaluate((dlg) => {
    if (dlg.querySelector(".sapMComboBox")) return "ComboBox";
    if (dlg.querySelector(".sapMSlt, .sapMSelect")) return "Select";
    return "unknown";
  });

  let options;

  if (kind === "Select") {
    const select = dialog.locator(".sapMSlt, .sapMSelect").first();
    await select.click();
    await page.waitForTimeout(200);
    await page.keyboard.press("F4");
    await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 5000 });
    options = await page.locator('[role="listbox"] [role="option"]').allTextContents();
    await page.keyboard.press("Escape");
  } else {
    // ComboBox variant — open the popup via JS and poll until the options stabilise
    const readOptions = (ph) =>
      page.evaluate((placeholder) => {
        const inner = document.querySelector(`.sapMComboBoxInner[placeholder="${placeholder}"]`);
        const box = inner?.closest(".sapMComboBox");
        if (!box) return null;
        let popup = document.getElementById(`${box.id}-popup-list-listUl`);
        if (!popup) {
          box.querySelector('[role="button"]')?.click();
          popup = document.getElementById(`${box.id}-popup-list-listUl`);
        }
        if (!popup) return null;
        return [...popup.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim() ?? "");
      }, ph);

    const input = dialog.locator('input.sapMComboBoxInner[placeholder="Select or Type Name"]').first();
    await expect(input).toBeVisible({ timeout: 5000 });

    const PH = "Select or Type Name";
    let previous = null;
    await expect(async () => {
      const current = await readOptions(PH);
      if (!current || current.length === 0) {
        previous = current ?? null;
        throw new Error("options not rendered yet");
      }
      if (previous && current.length === previous.length && current.every((v, i) => v === previous[i])) {
        options = current;
        return;
      }
      previous = current;
      throw new Error(`options still settling (${current.length})`);
    }).toPass({ timeout: 8000, intervals: [150, 300, 500] });

    // Close the popup
    await page.evaluate((ph) => {
      const inner = document.querySelector(`.sapMComboBoxInner[placeholder="${ph}"]`);
      const box = inner?.closest(".sapMComboBox");
      if (!box) return;
      if (document.getElementById(`${box.id}-popup-list-listUl`)) {
        box.querySelector('[role="button"]')?.click();
      }
    }, PH);
  }

  return options.map((o) => o.trim()).filter(Boolean);
}

/**
 * Clicks the Select Options arrow of the ComboBox with the given placeholder inside
 * the dialog and returns all option texts, polling until the list is stable.
 *
 * UI5 renders the dropdown popup asynchronously; this polls until the popup is open
 * and its options are non-empty AND stable across two consecutive reads.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} dialog
 * @param {string} placeholder
 * @returns {Promise<string[]>}
 */
async function readComboboxOptions(page, dialog, placeholder) {
  await expect(dialog.locator(`input.sapMComboBoxInner[placeholder="${placeholder}"]`).first()).toBeVisible({ timeout: 5000 });

  const openAndRead = (ph) =>
    page.evaluate((placeholderArg) => {
      const inner = document.querySelector(`.sapMComboBoxInner[placeholder="${placeholderArg}"]`);
      const box = inner?.closest(".sapMComboBox");
      if (!box) return null;
      let popup = document.getElementById(`${box.id}-popup-list-listUl`);
      if (!popup) {
        box.querySelector('[role="button"]')?.click();
        popup = document.getElementById(`${box.id}-popup-list-listUl`);
      }
      if (!popup) return null;
      return [...popup.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim() ?? "");
    }, ph);

  let previous = null;
  let stable = [];
  await expect(async () => {
    const current = await openAndRead(placeholder);
    if (!current || current.length === 0) {
      previous = current ?? null;
      throw new Error(`ComboBox "${placeholder}" options not rendered yet`);
    }
    if (previous && current.length === previous.length && current.every((v, i) => v === previous[i])) {
      stable = current;
      return;
    }
    previous = current;
    throw new Error(`ComboBox "${placeholder}" options still settling (${current.length})`);
  }).toPass({ timeout: 8000, intervals: [150, 300, 500] });

  // Close the popup
  await page.evaluate((ph) => {
    const inner = document.querySelector(`.sapMComboBoxInner[placeholder="${ph}"]`);
    const box = inner?.closest(".sapMComboBox");
    if (!box) return;
    if (document.getElementById(`${box.id}-popup-list-listUl`)) {
      box.querySelector('[role="button"]')?.click();
    }
  }, placeholder);

  return stable;
}

/**
 * In the View Settings dialog's Sort tab, asserts that the full set of sortable
 * properties (already-selected rows + available "Sort By" dropdown options) matches
 * `expectedOptions` exactly (order-insensitive).
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} dialog
 * @param {string[]} expectedOptions
 */
async function assertP13nSortOptions(page, dialog, expectedOptions) {
  await dialog.getByRole("tab", { name: "Sort" }).click();

  const dropdownOptions = await readComboboxOptions(page, dialog, "Sort By");

  // Read the pre-selected sort rows; poll until every rendered row has resolved its label.
  let selectedValues = [];
  await expect(async () => {
    const { values, total } = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input.sapMComboBoxInner[placeholder="Sort By"]')];
      return { values: inputs.map((i) => i.value.trim()), total: inputs.length };
    });
    const populated = values.filter(Boolean);
    if (populated.length < total - 1) {
      throw new Error(`Sort selected rows still settling (${populated.length}/${total} populated)`);
    }
    selectedValues = populated;
  }).toPass({ timeout: 8000, intervals: [150, 300, 500] });

  const actual = [...new Set([...selectedValues, ...dropdownOptions])];

  const remaining = [...actual];
  const unmatched = [];
  for (const expected of expectedOptions) {
    const idx = remaining.findIndex((a) => a === expected);
    if (idx === -1) {
      unmatched.push(expected);
    } else {
      remaining.splice(idx, 1);
    }
  }
  expect(
    unmatched.length === 0 && remaining.length === 0,
    `Sort options mismatch.\n  unmatched expected: ${unmatched.join(", ") || "(none)"}\n  leftover actual: ${remaining.join(", ") || "(none)"}\n  actual (all): ${[...actual].sort().join(", ")}`
  ).toBe(true);
}

/**
 * In the View Settings dialog's Columns tab, asserts that:
 * - the selected (visible) columns match `selectedColumns` in order
 * - all rows (selected + unselected) match `allColumns` (order-insensitive)
 *
 * @param {import('@playwright/test').Locator} dialog
 * @param {string[]} selectedColumns  - columns that should be checked/selected, in display order
 * @param {string[]} allColumns       - every column that should appear in the list (selected or not)
 */
async function assertP13nColumns(dialog, selectedColumns, allColumns) {
  await dialog.getByRole("tab", { name: "Columns" }).click();
  const grid = dialog.getByRole("grid");
  const selectedRows = grid.getByRole("row", { selected: true });
  await expect(selectedRows).toHaveCount(selectedColumns.length, { timeout: 10000 });
  for (let i = 0; i < selectedColumns.length; i++) {
    await expect(selectedRows.nth(i)).toContainText(selectedColumns[i]);
  }
  const rows = grid.getByRole("row");
  await rows.first().waitFor({ timeout: 10000 });
  const rowTexts = await rows.evaluateAll((els) =>
    els
      .slice(1)
      .map((el) => (el.textContent ?? "").replace(/Item\s+Selection/g, "").trim())
      .filter(Boolean)
  );
  expect(
    rowTexts.sort(),
    `P13n columns mismatch\n  actual:   ${JSON.stringify(rowTexts.sort())}\n  expected: ${JSON.stringify([...allColumns].sort())}`
  ).toEqual([...allColumns].sort());
}

module.exports = { openAdaptFiltersDialog, getAvailableAddFilterOptions, assertP13nSortOptions, assertP13nColumns };
