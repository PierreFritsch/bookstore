---
name: playwright
description: For Playwright-testing the app, remember to use basic auth user alice and empty password
---

For Playwright-testing the app, remember to use basic auth user alice and empty password


# Browser basic auth dialog blocks page load

## Symptom

Playwright navigates to `localhost:4004` or `localhost:4044` and the page never becomes ready — 
tests time out waiting for a UI element that never appears. 

The native browser "Sign in" dialog (username/password prompt) covers the page.

## Context

Any Playwright session against the local dev UI. Happens on first navigation in a
new browser context; the dialog is modal and prevents all subsequent interaction.

## Root cause

The local UI server is protected by HTTP Basic Auth. Chromium shows a native credentials dialog
that Playwright cannot interact with via normal DOM APIs — `waitForSelector`, `click`, etc. all
block behind it.

## Fix

### In E2E test code

Supply credentials **before** (or as part of) the first navigation. Two equivalent approaches:

```typescript
// Option A — page.authenticate() before navigate
await page.authenticate({ username: 'alice', password: '' });
await page.goto('http://localhost:4004');

// Option B — URL-embedded credentials
await page.goto('http://alice:@http://localhost:4004');
```

Credentials are defined in `test/ui/e2e/config.ts`.

### In Playwright MCP (browser_run_code_unsafe)

`page.authenticate()` is **not available** in the MCP browser context — it throws
`TypeError: page.authenticate is not a function`. Use `page.context().setHTTPCredentials()`
instead, and call it **before** `page.goto()`:

```javascript
async (page) => {
  await page.context().setHTTPCredentials({ username: 'alice', password: '' });
  await page.goto('http://localhost:4004/?...');
  await page.waitForTimeout(10000); // app bootstrap takes ~10s
  return await page.title();
}
```

If the dialog is **already showing** (previous navigation without credentials), add a dialog
listener before reloading:

```javascript
async (page) => {
  await page.context().setHTTPCredentials({ username: 'alice', password: '' });
  page.on('dialog', async dialog => { await dialog.accept(); });
  await page.reload();
  await page.waitForTimeout(10000);
}
```

`browser_navigate` does NOT support credentials — always use `browser_run_code_unsafe` for the
first navigation to a protected URL.

## How it was verified

`page.context().setHTTPCredentials()` + reload is the pattern that works in the MCP context.
`page.authenticate()` works in the Playwright E2E test suite. 

## Applies to

All agents doing live UI / annotation verification via the Playwright MCP server or direct
Playwright scripts against `localhost:4004`.
