import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const httpStatusOk = 200;
const noBody = 0;
const noStyles = 0;
const greeting = "Hello from Alchemy KV";
const firstCount = "Count: 0";
const nextCount = "Count: 1";
const smallViewport = { height: 844, width: 390 };

const expectServerResponse = async (request: APIRequestContext): Promise<void> => {
  const response = await request.get("/");
  expect(response.status()).toBe(httpStatusOk);
  expect(await response.text()).toContain(greeting);
  const head = await request.head("/");
  expect(head.status()).toBe(httpStatusOk);
  expect(await head.body()).toHaveLength(noBody);
};

const expectHydratedAction = async (page: Page): Promise<void> => {
  await page.goto("/");
  // SSR can expose the button before the development client modules finish loading.
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("kv-greeting")).toHaveText(greeting);
  await page.getByRole("button", { exact: true, name: firstCount }).click();
  await expect(page.getByRole("button", { exact: true, name: nextCount })).toBeVisible();
  await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
  await expect(page.getByTestId("action-greeting")).toHaveText(`${greeting}, Ada!`);
};

test("native Alchemy Worker serves KV-backed RSC, hydration, Server Functions and navigation", async ({
  page,
  request,
}) => {
  await expectServerResponse(request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expectHydratedAction(page);
  await page.getByRole("link", { exact: true, name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/u);
  await expect(page.getByTestId("label")).toHaveText("Effront + Alchemy");
  expect(errors).toEqual([]);
});

const expectInitialStyles = async (page: Page): Promise<void> => {
  await expect(page.getByRole("main")).toHaveCSS("max-width", "768px");
  await expect(page.getByRole("button", { exact: true, name: firstCount })).toHaveCSS(
    "padding-left",
    "16px",
  );
};

test("Tailwind utilities style the native application and fit a narrow viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expectInitialStyles(page);
  await expect(page.getByRole("button", { exact: true, name: firstCount })).toHaveCSS(
    "padding-top",
    "8px",
  );
  await page.setViewportSize(smallViewport);
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(smallViewport.width);
});

test("generated Tailwind stylesheet styles initial HTML without JavaScript", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL("/", baseURL).href);
    await expectInitialStyles(page);
    const hrefs = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(noStyles);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  } finally {
    await context.close();
  }
});
