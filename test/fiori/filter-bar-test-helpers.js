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

module.exports = { openAdaptFiltersDialog, getAvailableAddFilterOptions };
