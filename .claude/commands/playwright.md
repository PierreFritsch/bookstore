---
name: playwright
description: Useful hints for accessing the app with Playwright
---


## Authentication

The CAP server uses basic auth with mocked users (e.g. `alice` with empty password).

Since Playwright MCP tools don't support creating new browser contexts, set the `Authorization` header on the existing context using `setExtraHTTPHeaders` via `browser_run_code`. The base64 encoding of `alice:` is `YWxpY2U6`.

## Navigation

Navigate to `http://localhost:4004/fiori-apps.html#Shell-home` first, then change `window.location.hash` to reach the target app. Direct navigation with the hash in the URL may not work — always navigate to the shell home first, wait, then set the hash.

## Full example

Use `browser_run_code` to set up auth, navigate, and reach the target app:

1. Use `browser_run_code` to set auth and navigate:

```ts
async (page) => {
  await page.context().setExtraHTTPHeaders({
    "Authorization": "Basic YWxpY2U6"
  });
  await page.goto("http://localhost:4004/fiori-apps.html#Shell-home");
  await page.waitForSelector('text=Home', { timeout: 10000 });
  await page.evaluate(() => { window.location.hash = "#Authors-manage"; });
}
```

2. Then use `browser_wait_for` to wait for expected content (e.g. `Emily`) before taking a `browser_snapshot`.
