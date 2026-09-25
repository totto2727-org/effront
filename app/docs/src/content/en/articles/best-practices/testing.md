Test Route, Page, Layout, and Server Function behavior through a running application with Playwright.
Effront does not provide a public Vitest harness for Page/Layout rendering or Server Function requests.

<span id="production"></span>

## Use the runnable example {#tools}

The tests below target the [Basic example application](https://github.com/totto2727-org/effront/tree/main/examples/basic).
Its [maintained Playwright setup](https://github.com/totto2727-org/effront/tree/main/tests/e2e-alchemy) builds the example and starts a local workerd host without Cloudflare authentication.
The setup is a repository reference, not a test helper distributed with Effront.

Follow the [setup and execution instructions](https://github.com/totto2727-org/effront/blob/main/docs/TESTING.md#native-alchemy-integration) to run the reference application.
Save each code block below as the named file beside `alchemy.e2e.ts` in that test package, then rerun its browser suite.
The existing [Playwright configuration](https://github.com/totto2727-org/effront/blob/main/tests/e2e-alchemy/playwright.config.ts) supplies `baseURL` and manages the server lifecycle.
For your own application, replace the URLs, selectors, and expected values with your application's outputs.

## Test Route responses {#routes}

The example registers `/` and `/about` with `EFFRONT.Routes.make().page(...)`.
Check route availability and missing-route status through HTTP requests.
Save as `routes.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

test("registered routes return HTML and unknown routes return 404", async ({ request }) => {
  for (const path of ["/", "/about"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  }

  const missing = await request.get("/not-a-route");
  expect(missing.status()).toBe(404);
});
```

The assertions exercise the routes in the built application, including its configured middleware.
See the example's [route registration](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/entry.effront.tsx).

## Test Page output and hydration {#pages}

`HomePage` renders a greeting from the application's `Host` service and includes a client counter.
Save as `page.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

test("HomePage renders service data and hydrates its counter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hello, world!");
  await expect(page.getByTestId("kv-greeting")).toHaveText("Hello from Alchemy KV");

  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
});
```

The greeting checks server-rendered data.
The increment checks the client component after hydration.
The fixed example's [maintained test](https://github.com/totto2727-org/effront/blob/main/tests/e2e-alchemy/alchemy.e2e.ts) waits for `networkidle` before interacting with its client controls.

## Test Layout retention across navigation {#layouts}

`RootLayout` wraps both Pages in a shared [`Shell`](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/components/shell.tsx).
Verify that the Page changes while the original navigation element remains connected.
Save as `layout.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

test("RootLayout retains its navigation when the Page changes", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const navigation = await page.getByRole("navigation").elementHandle();
  if (!navigation) throw new Error("Expected the shared navigation");

  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("About");
  await expect(page.getByTestId("label")).toHaveText("Effront + Alchemy");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Home" })).toBeVisible();
  expect(await navigation.evaluate((element) => element.isConnected)).toBe(true);
});
```

The DOM identity check detects a remount even when the replacement navigation looks identical.
Run this retention check in Chromium, which supports the Navigation API used for client navigation.
A full-document navigation replaces the layout DOM.

<span id="services"></span>

## Test a Server Function through its client {#server-functions}

The example's [`GreetingAction`](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/features/greeting/client.tsx) submits `greet("Ada")` through a Client Component.
The [`greet` Server Function](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/features/greeting/server.ts) reads the request's `Host` service and returns the greeting.
Save as `server-function.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the Server Function returns a greeting to its client", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const result = page.getByTestId("action-greeting");
  await expect(result).toHaveText("");

  await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
  await expect(result).toHaveText("Hello from Alchemy KV, Ada!");
});
```

The button click exercises the browser request, server execution, and returned value.
A direct call to an Effront Server Function in a server-side Vitest test rejects with a `TypeError`.
The test covers a read operation, without a persistence or authorization check.
