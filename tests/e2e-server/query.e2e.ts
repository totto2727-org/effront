import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "bun", "Query playground is owned by the Node fixture");
  await page.goto("/loading/query");
  await page.waitForLoadState("networkidle");
});

test("query fetching is event-gated, not SSR or automatic on hydration", async ({
  browser,
  baseURL,
  page,
  request,
}) => {
  const response = await request.get("/loading/query");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("開始（ブラウザーで取得）");
  expect(html).not.toContain('data-testid="query-result"');
  expect(html).not.toContain('data-testid="query-fallback"');
  await expect(page.getByRole("button", { name: "開始（ブラウザーで取得）" })).toBeVisible();
  // Waiting past the query delay would expose accidental post-hydration fetching.
  await page.waitForTimeout(2_100);
  expect(
    await page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => entry.name.includes("/loading-query.txt")).length,
    ),
  ).toBe(0);
  await expect(page.getByTestId("query-result")).toHaveCount(0);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const noJS = await context.newPage();
    await noJS.goto(`${baseURL}/loading/query`);
    await noJS.getByRole("button", { name: "開始（ブラウザーで取得）" }).click();
    await expect(noJS.getByTestId("query-result")).toHaveCount(0);
    await expect(noJS.getByTestId("query-fallback")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("child-owned query shows initial and urgent fallbacks, retains transition and background data", async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/loading-query.txt"))
      requests.push(new URL(request.url()).searchParams.get("item") ?? "");
  });
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await page.getByRole("button", { name: "開始（ブラウザーで取得）" }).click();
  const fallback = page.getByTestId("query-fallback");
  const result = page.getByTestId("query-result");
  await expect(fallback).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
  await expect(result).toContainText("項目 1：ブラウザーから取得した静的サンプルです。");
  await expect(fallback).toBeHidden();

  await page.getByRole("button", { name: "通常のキー変更（2秒）", exact: true }).click();
  await expect(fallback).toBeVisible();
  await expect(result).toBeHidden();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
  await expect(result).toContainText("項目 2：");
  await expect(result).toBeVisible();

  await page.getByRole("button", { name: "Transition のキー変更（2秒）", exact: true }).click();
  await expect(page.getByText("Transition 待機中：前の結果を保持", { exact: true })).toBeVisible();
  await expect(result).toContainText("項目 2：");
  await expect(result).toBeVisible();
  await expect(fallback).toBeHidden();
  await expect(result).toContainText("項目 3：");
  await expect(page.getByText("選択中のキー：3", { exact: true })).toBeVisible();

  // Repeated refetch must reuse the same cached query without suspending or resetting the client.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const updated = page.getByTestId("query-updated-at");
    const before = await updated.getAttribute("data-updated-at");
    await page.getByRole("button", { name: "同じキーを再取得（2秒）" }).click();
    await expect(
      page.getByText("バックグラウンド再取得中：キャッシュを表示", { exact: true }),
    ).toBeVisible();
    await expect(result).toContainText("項目 3：");
    await expect(result).toBeVisible();
    await expect(updated).toHaveAttribute("data-updated-at", before ?? "");
    await expect(fallback).toBeHidden();
    await expect(page.getByText("Transition 待機中：前の結果を保持", { exact: true })).toBeHidden();
    await expect(page.getByText("取得完了", { exact: true })).toBeVisible();
    expect(Number(await updated.getAttribute("data-updated-at"))).toBeGreaterThan(Number(before));
  }
  expect(requests).toEqual(["1", "2", "3", "3", "3"]);
  expect(errors).toEqual([]);
});

test("failed background fetch retains data and can be retried", async ({ page }) => {
  await page.getByRole("button", { name: "開始（ブラウザーで取得）" }).click();
  await expect(page.getByTestId("query-result")).toContainText("項目 1：");
  await page.route(
    "**/loading-query.txt?*",
    (route) => route.fulfill({ status: 503, body: "Unavailable" }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "同じキーを再取得（2秒）" }).click();
  await expect(page.getByRole("alert")).toContainText("再取得に失敗しました");
  await expect(page.getByTestId("query-result")).toBeVisible();
  await expect(page.getByTestId("query-fallback")).toBeHidden();
  await page.getByRole("button", { name: "同じキーを再取得（2秒）" }).click();
  await expect(
    page.getByText("バックグラウンド再取得中：キャッシュを表示", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toBeHidden();
  await expect(page.getByText("取得完了", { exact: true })).toBeVisible();
});

test("query sample is linked from the playground and fits a narrow viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("link", { name: "使い方", exact: true }).click();
  await page.getByRole("link", { name: "4. Query で Suspend", exact: true }).click();
  await expect(page).toHaveURL(/\/loading\/query$/);
  await page.getByRole("button", { name: "開始（ブラウザーで取得）" }).click();
  await expect(page.getByTestId("query-result")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: testInfo.outputPath("query-mobile.png"), fullPage: true });
});
