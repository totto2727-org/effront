import { expect, test } from "@playwright/test";
import type { APIRequestContext, Browser, Page } from "@playwright/test";

const queryPath = "/loading/query";
const starter = "開始（ブラウザーで取得）";
const refetchLabel = "同じキーを再取得（2秒）";
const backgroundPending = "バックグラウンド再取得中：キャッシュを表示";
const transitionPending = "Transition 待機中：前の結果を保持";
const afterQueryDelay = 2100;
const noRequests = 0;
const noResults = 0;
const unavailable = 503;
const oneFailure = 1;
const narrowViewport = { height: 812, width: 375 };

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "bun", "Query playground is owned by the Node fixture");
  await page.goto(queryPath);
  await page.waitForLoadState("networkidle");
});

const start = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: starter }).click();
};

const refetch = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: refetchLabel }).click();
};

const expectInitialHtml = async (request: APIRequestContext): Promise<void> => {
  const response = await request.get(queryPath);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain(starter);
  expect(html).not.toContain('data-testid="query-result"');
  expect(html).not.toContain('data-testid="query-fallback"');
};

const expectNoHydrationFetch = async (page: Page): Promise<void> => {
  await expect(page.getByRole("button", { name: starter })).toBeVisible();
  // Wait beyond the deliberately delayed query so an eager hydration fetch would be visible.
  await page.waitForTimeout(afterQueryDelay);
  const requests = await page.evaluate(
    () =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/loading-query.txt")).length,
  );
  expect(requests).toBe(noRequests);
  await expect(page.getByTestId("query-result")).toHaveCount(noResults);
};

const expectNoScriptFetch = async (
  browser: Browser,
  baseURL: string | undefined,
): Promise<void> => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL(queryPath, baseURL).href);
    await start(page);
    await expect(page.getByTestId("query-result")).toHaveCount(noResults);
    await expect(page.getByTestId("query-fallback")).toHaveCount(noResults);
  } finally {
    await context.close();
  }
};

test("query fetching is event-gated, not SSR or automatic on hydration", async ({
  baseURL,
  browser,
  page,
  request,
}) => {
  await expectInitialHtml(request);
  await expectNoHydrationFetch(page);
  await expectNoScriptFetch(browser, baseURL);
});

type QueryObservations = Readonly<{ errors: string[]; requests: string[] }>;

const observeQueries = (page: Page): QueryObservations => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/loading-query.txt")) {
      requests.push(url.searchParams.get("item") ?? "");
    }
  });
  return { errors, requests };
};

const expectInitialQuery = async (page: Page): Promise<void> => {
  await page.getByRole("button", { exact: true, name: "Count: 0" }).click();
  await start(page);
  const fallback = page.getByTestId("query-fallback");
  await expect(fallback).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
  await expect(page.getByTestId("query-result")).toContainText(
    "項目 1：ブラウザーから取得した静的サンプルです。",
  );
  await expect(fallback).toBeHidden();
};

const expectUrgentChange = async (page: Page): Promise<void> => {
  await page.getByRole("button", { exact: true, name: "通常のキー変更（2秒）" }).click();
  const result = page.getByTestId("query-result");
  await expect(page.getByTestId("query-fallback")).toBeVisible();
  await expect(result).toBeHidden();
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
  await expect(result).toContainText("項目 2：");
  await expect(result).toBeVisible();
};

const expectTransitionChange = async (page: Page): Promise<void> => {
  await page.getByRole("button", { exact: true, name: "Transition のキー変更（2秒）" }).click();
  await expect(page.getByText(transitionPending, { exact: true })).toBeVisible();
  const result = page.getByTestId("query-result");
  await expect(result).toContainText("項目 2：");
  await expect(result).toBeVisible();
  await expect(page.getByTestId("query-fallback")).toBeHidden();
  await expect(result).toContainText("項目 3：");
  await expect(page.getByText("選択中のキー：3", { exact: true })).toBeVisible();
};

const expectRefetchPending = async (page: Page, before: string | null): Promise<void> => {
  const result = page.getByTestId("query-result");
  await expect(page.getByText(backgroundPending, { exact: true })).toBeVisible();
  await expect(result).toContainText("項目 3：");
  await expect(result).toBeVisible();
  await expect(page.getByTestId("query-updated-at")).toHaveAttribute(
    "data-updated-at",
    before ?? "",
  );
  await expect(page.getByTestId("query-fallback")).toBeHidden();
  await expect(page.getByText(transitionPending, { exact: true })).toBeHidden();
};

const expectRefetch = async (page: Page): Promise<void> => {
  const updated = page.getByTestId("query-updated-at");
  const before = await updated.getAttribute("data-updated-at");
  await refetch(page);
  await expectRefetchPending(page, before);
  await expect(page.getByText("取得完了", { exact: true })).toBeVisible();
  const after = await updated.getAttribute("data-updated-at");
  expect(Number(after)).toBeGreaterThan(Number(before));
};

test("child-owned query shows initial and urgent fallbacks, retains transition and background data", async ({
  page,
}) => {
  const { errors, requests } = observeQueries(page);
  await expectInitialQuery(page);
  await expectUrgentChange(page);
  await expectTransitionChange(page);
  // Repeat the same key to detect a discarded QueryClient or accidental suspension.
  await expectRefetch(page);
  await expectRefetch(page);
  expect(requests).toEqual(["1", "2", "3", "3", "3"]);
  expect(errors).toEqual([]);
});

const expectFailedRefetch = async (page: Page): Promise<void> => {
  await page.route(
    "**/loading-query.txt?*",
    async (route) => route.fulfill({ body: "Unavailable", status: unavailable }),
    { times: oneFailure },
  );
  await refetch(page);
  await expect(page.getByRole("alert")).toContainText("再取得に失敗しました");
  await expect(page.getByTestId("query-result")).toBeVisible();
  await expect(page.getByTestId("query-fallback")).toBeHidden();
};

test("failed background fetch retains data and can be retried", async ({ page }) => {
  await start(page);
  await expect(page.getByTestId("query-result")).toContainText("項目 1：");
  await expectFailedRefetch(page);
  await refetch(page);
  await expect(page.getByText(backgroundPending, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toBeHidden();
  await expect(page.getByText("取得完了", { exact: true })).toBeVisible();
});

test("query sample is linked from the playground and fits a narrow viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(narrowViewport);
  await page.getByRole("link", { exact: true, name: "使い方" }).click();
  await page.getByRole("link", { exact: true, name: "4. Query で Suspend" }).click();
  await expect(page).toHaveURL(/\/loading\/query$/u);
  await start(page);
  await expect(page.getByTestId("query-result")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(narrowViewport.width);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("query-mobile.png") });
});
