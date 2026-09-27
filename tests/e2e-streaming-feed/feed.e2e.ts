import { expect, test } from "@playwright/test";

test("initial feed renders six notes without JavaScript", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await expect(page.locator("[data-story-id]")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Field note 1" })).toBeVisible();

  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const document = await context.newPage();
    await document.goto(baseURL!);
    await expect(document.locator("[data-story-id]")).toHaveCount(6);
    await expect(document.getByRole("heading", { name: "Field note 1" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("loading next page streams notes without navigation or discarding expanded cards", async ({
  page,
}) => {
  const requests: string[] = [];
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/_effront/query"))
      requests.push(request.url());
    if (request.isNavigationRequest()) documents.push(request.url());
  });

  await page.goto("/");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.locator('[data-story-id="1"]').getByRole("button", { name: "Read note" }).click();
  await expect(page.locator('[data-story-id="1"]')).toContainText("The full story for note 1");
  await page.getByRole("button", { name: "Load 6 more notes" }).click();
  await page.locator('[data-story-id="7"]').waitFor();
  expect(await page.locator("[data-story-id]").count()).toBeLessThan(12);
  await expect(page.locator("[data-story-id]")).toHaveCount(12);
  await expect(page.locator('[data-story-id="1"]').getByRole("button")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(documents).toEqual([page.url()]);
  expect(requests).toHaveLength(2);
  expect(requests.every((url) => url.endsWith("/_effront/query"))).toBe(true);
});

test("failed page query retries without losing previously received notes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.route("**/_effront/query", (route) => route.abort(), { times: 1 });
  await page.getByRole("button", { name: "Load 6 more notes" }).click();
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await expect(page.locator("[data-story-id]")).toHaveCount(6);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("[data-story-id]")).toHaveCount(12);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("failed note query can be retried without refreshing the feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.route("**/_effront/query", (route) => route.abort(), { times: 1 });
  const first = page.locator('[data-story-id="1"]');
  await first.getByRole("button", { name: "Read note" }).click();
  await first.getByRole("button", { name: "Retry note" }).click();
  await expect(first).toContainText("The full story for note 1");
  await expect(page.locator("[data-story-id]")).toHaveCount(6);
});

test("navigating away interrupts an unfinished stream", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  const request = page.waitForRequest(
    (candidate) => candidate.method() === "POST" && candidate.url().endsWith("/_effront/query"),
  );
  await page.getByRole("button", { name: "Load 6 more notes" }).click();
  const pending = await request;
  await page.locator('[data-story-id="7"]').waitFor();
  const aborted = page.waitForEvent("requestfailed", { predicate: (failed) => failed === pending });
  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("heading", { name: "About this feed" })).toBeVisible();
  await aborted;
});
