import { expect, test } from "@playwright/test";

// This feature belongs to the Node fixture. Existing server.e2e.ts still covers Bun.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "bun", "Loading playground is owned by the Node fixture");
  await page.goto("/loading");
  // Match the existing host suite: SSR buttons may be visible before dev modules hydrate.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
});

test("plain anchor navigation shows route Loading without replacing the layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("link", { name: "1. リンクで2秒待つ" }).click();
  await expect(page.getByTestId("route-loading")).toBeVisible();
  await expect(page.getByTestId("loading-layout")).toBeVisible();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "リンク先のページが完成（2秒）" })).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
  await expect(page).toHaveURL(/\/loading\/navigation$/);
  expect(errors).toEqual([]);
});

test("independent siblings reveal separately or together while a dependent child starts after its parent", async ({
  page,
}) => {
  await page.getByRole("link", { name: "2. 段階的な表示" }).click();
  const separate = page.getByRole("region", { name: "並列・別々の境界" });
  const shared = page.getByRole("region", { name: "並列・共通の境界" });
  const nested = page.getByRole("region", { name: "直列・入れ子の境界" });
  await expect(separate.getByText("A1 を読み込み中（1秒）…", { exact: true })).toBeVisible();
  await expect(shared.getByRole("status")).toBeVisible();
  await expect(nested.getByText("親を読み込み中（1.5秒）…", { exact: true })).toBeVisible();
  await expect(separate.getByText("A1 完了（1秒）", { exact: true })).toBeVisible();
  await expect(separate.getByText("A2 を読み込み中（3秒）…", { exact: true })).toBeVisible();
  await expect(shared.getByText("B1 完了（1秒）", { exact: true })).toBeHidden();
  await expect(shared.getByRole("status")).toBeVisible();
  await expect(nested.getByText("親 完了（1.5秒）", { exact: true })).toBeVisible();
  await expect(nested.getByText("子を読み込み中（ここから1.5秒）…", { exact: true })).toBeVisible();
  await expect(separate.getByText("A2 完了（3秒）", { exact: true })).toBeVisible();
  await expect(shared.getByText("B1 完了（1秒）", { exact: true })).toBeVisible();
  await expect(shared.getByText("B2 完了（3秒）", { exact: true })).toBeVisible();
  await expect(
    nested.getByText("子 完了（親の結果を使用 + 1.5秒）", { exact: true }),
  ).toBeVisible();

  // Server-produced intervals establish overlap/dependency independently of browser wall time.
  for (const [region, first, second] of [
    [separate, "A1 完了（1秒）", "A2 完了（3秒）"],
    [shared, "B1 完了（1秒）", "B2 完了（3秒）"],
  ] as const) {
    const firstResult = region.getByText(first, { exact: true });
    const secondResult = region.getByText(second, { exact: true });
    expect(Number(await secondResult.getAttribute("data-started-at"))).toBeLessThan(
      Number(await firstResult.getAttribute("data-completed-at")),
    );
    expect(Number(await firstResult.getAttribute("data-started-at"))).toBeLessThan(
      Number(await secondResult.getAttribute("data-completed-at")),
    );
  }
  const parent = nested.getByText("親 完了（1.5秒）", { exact: true });
  const child = nested.getByText("子 完了（親の結果を使用 + 1.5秒）", { exact: true });
  await expect(parent).toHaveAttribute("data-completed-at", /^\d+$/);
  await expect(child).toHaveAttribute("data-started-at", /^\d+$/);
  expect(Number(await child.getAttribute("data-started-at"))).toBeGreaterThanOrEqual(
    Number(await parent.getAttribute("data-completed-at")),
  );
});

test("urgent interaction without a local boundary hides the page but preserves layout state", async ({
  page,
}) => {
  await page.getByRole("link", { name: "3. 操作で Suspend" }).click();
  const route = page.getByRole("region", { name: "ルート境界", exact: true });
  await route.getByRole("button", { name: "通常更新（2秒）", exact: true }).click();
  await expect(page.getByTestId("route-loading")).toBeVisible();
  await expect(page.getByTestId("interaction-page")).toBeHidden();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  await expect(route.getByText("更新 1 完了（2秒）", { exact: true })).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
});

test("urgent interaction with a local boundary only replaces that result and can be repeated", async ({
  page,
}) => {
  await page.getByRole("link", { name: "3. 操作で Suspend" }).click();
  const local = page.getByRole("region", { name: "ローカル境界", exact: true });
  for (const attempt of [1, 2]) {
    await local.getByRole("button", { name: "通常更新（2秒）", exact: true }).click();
    await expect(local.getByText("結果欄だけ読み込み中（2秒）…", { exact: true })).toBeVisible();
    await expect(page.getByTestId("route-loading")).toBeHidden();
    await expect(page.getByRole("region", { name: "ルート境界", exact: true })).toBeVisible();
    await expect(local.getByRole("button", { name: "通常更新（2秒）", exact: true })).toBeVisible();
    await expect(local.getByText(`更新 ${attempt} 完了（2秒）`, { exact: true })).toBeVisible();
  }
});

for (const name of ["ルート境界", "ローカル境界"]) {
  test(`transition in ${name} retains revealed content rather than showing a fallback`, async ({
    page,
  }) => {
    await page.getByRole("link", { name: "3. 操作で Suspend" }).click();
    const region = page.getByRole("region", { name, exact: true });
    await region.getByRole("button", { name: "Transition 更新（2秒）", exact: true }).click();
    await expect(region.getByRole("status")).toHaveText("Transition 待機中：前の結果を保持");
    await expect(region.getByText("初期結果（待機なし）", { exact: true })).toBeVisible();
    await expect(page.getByTestId("route-loading")).toBeHidden();
    await expect(page.getByText("結果欄だけ読み込み中（2秒）…", { exact: true })).toBeHidden();
    await expect(region.getByText("更新 1 完了（2秒）", { exact: true })).toBeVisible();
    await expect(region.getByRole("status")).toHaveText("操作できます");
  });
}

for (const destination of ["2. 段階的な表示", "3. 操作で Suspend"]) {
  test(`${destination} stays readable on a narrow viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("link", { name: destination }).click();
    if (destination === "2. 段階的な表示") {
      await expect(
        page.getByText("子 完了（親の結果を使用 + 1.5秒）", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/サーバー UTC：開始/)).toHaveCount(6);
    } else {
      await expect(page.getByTestId("interaction-page")).toBeVisible();
    }
    await expect(page.getByTestId("loading-layout")).toHaveCSS(
      "background-color",
      "oklch(0.932 0.032 255.585)",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    await page.screenshot({ path: testInfo.outputPath("loading-mobile.png"), fullPage: true });
  });
}

test("plain links navigate without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/loading`);
    await page.getByRole("link", { name: "1. リンクで2秒待つ" }).click();
    await expect(page).toHaveURL(/\/loading\/navigation$/);
    await page.waitForLoadState("load");
  } finally {
    await context.close();
  }
});

test("without navigation precommit a plain link uses a document navigation and resets layout state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "NavigationPrecommitController", { value: undefined });
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "1. リンクで2秒待つ" }).click();
  await expect(page).toHaveURL(/\/loading\/navigation$/);
  await expect(page.getByRole("heading", { name: "リンク先のページが完成（2秒）" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toBeVisible();
});
