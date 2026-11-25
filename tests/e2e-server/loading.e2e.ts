import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const navigationLink = "1. リンクで2秒待つ";
const stagesLink = "2. 段階的な表示";
const interactionLink = "3. 操作で Suspend";
const completedA1 = "A1 完了（1秒）";
const completedA2 = "A2 完了（3秒）";
const completedB1 = "B1 完了（1秒）";
const completedB2 = "B2 完了（3秒）";
const completedParent = "親 完了（1.5秒）";
const completedChild = "子 完了（親の結果を使用 + 1.5秒）";
const localFallback = "結果欄だけ読み込み中（2秒）…";
const firstAttempt = 1;
const secondAttempt = 2;
const stageTimingCount = 6;
const narrowViewport = { height: 812, width: 375 };
const destinationHeading = "リンク先のページが完成（2秒）";

const countLayout = async (page: Page): Promise<void> => {
  await page.getByRole("button", { exact: true, name: "Count: 0" }).click();
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
};

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "bun", "Loading playground is owned by the Node fixture");
  await page.goto("/loading");
  // SSR buttons can appear before the dev host has hydrated the module.
  await page.waitForLoadState("networkidle");
  await countLayout(page);
});

test("plain anchor navigation shows route Loading without replacing the layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("link", { name: navigationLink }).click();
  await expect(page.getByTestId("route-loading")).toBeVisible();
  await expect(page.getByTestId("loading-layout")).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: destinationHeading })).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
  await expect(page).toHaveURL(/\/loading\/navigation$/u);
  expect(errors).toEqual([]);
});

type StageRegions = Readonly<{ nested: Locator; separate: Locator; shared: Locator }>;

const expectEarlyStages = async ({ nested, separate, shared }: StageRegions): Promise<void> => {
  await expect(separate.getByText("A1 を読み込み中（1秒）…", { exact: true })).toBeVisible();
  await expect(shared.getByRole("status")).toBeVisible();
  await expect(nested.getByText("親を読み込み中（1.5秒）…", { exact: true })).toBeVisible();
  await expect(separate.getByText(completedA1, { exact: true })).toBeVisible();
  await expect(separate.getByText("A2 を読み込み中（3秒）…", { exact: true })).toBeVisible();
  await expect(shared.getByText(completedB1, { exact: true })).toBeHidden();
  await expect(shared.getByRole("status")).toBeVisible();
};

const expectLateStages = async ({ nested, separate, shared }: StageRegions): Promise<void> => {
  await expect(nested.getByText(completedParent, { exact: true })).toBeVisible();
  await expect(nested.getByText("子を読み込み中（ここから1.5秒）…", { exact: true })).toBeVisible();
  await expect(separate.getByText(completedA2, { exact: true })).toBeVisible();
  await expect(shared.getByText(completedB1, { exact: true })).toBeVisible();
  await expect(shared.getByText(completedB2, { exact: true })).toBeVisible();
  await expect(nested.getByText(completedChild, { exact: true })).toBeVisible();
};

const readTime = async (
  result: Locator,
  mark: "data-completed-at" | "data-started-at",
): Promise<number> => {
  const value = await result.getAttribute(mark);
  return Number(value);
};

const expectOverlap = async (region: Locator, first: string, second: string): Promise<void> => {
  const firstResult = region.getByText(first, { exact: true });
  const secondResult = region.getByText(second, { exact: true });
  expect(await readTime(secondResult, "data-started-at")).toBeLessThan(
    await readTime(firstResult, "data-completed-at"),
  );
  expect(await readTime(firstResult, "data-started-at")).toBeLessThan(
    await readTime(secondResult, "data-completed-at"),
  );
};

const expectDependency = async (region: Locator): Promise<void> => {
  const parent = region.getByText(completedParent, { exact: true });
  const child = region.getByText(completedChild, { exact: true });
  await expect(parent).toHaveAttribute("data-completed-at", /^\d+$/u);
  await expect(child).toHaveAttribute("data-started-at", /^\d+$/u);
  expect(await readTime(child, "data-started-at")).toBeGreaterThanOrEqual(
    await readTime(parent, "data-completed-at"),
  );
};

test("independent siblings reveal separately or together while a dependent child starts after its parent", async ({
  page,
}) => {
  await page.getByRole("link", { name: stagesLink }).click();
  const separate = page.getByRole("region", { name: "並列・別々の境界" });
  const shared = page.getByRole("region", { name: "並列・共通の境界" });
  const nested = page.getByRole("region", { name: "直列・入れ子の境界" });
  await expectEarlyStages({ nested, separate, shared });
  await expectLateStages({ nested, separate, shared });
  // Server-produced intervals expose overlap and dependencies independently of browser wall time.
  await expectOverlap(separate, completedA1, completedA2);
  await expectOverlap(shared, completedB1, completedB2);
  await expectDependency(nested);
});

test("urgent interaction without a local boundary hides the page but preserves layout state", async ({
  page,
}) => {
  await page.getByRole("link", { name: interactionLink }).click();
  const route = page.getByRole("region", { exact: true, name: "ルート境界" });
  await route.getByRole("button", { exact: true, name: "通常更新（2秒）" }).click();
  await expect(page.getByTestId("route-loading")).toBeVisible();
  await expect(page.getByTestId("interaction-page")).toBeHidden();
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
  await expect(route.getByText("更新 1 完了（2秒）", { exact: true })).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
});

const expectUrgentLocalChange = async (
  page: Page,
  local: Locator,
  attempt: number,
): Promise<void> => {
  const update = local.getByRole("button", { exact: true, name: "通常更新（2秒）" });
  await update.click();
  await expect(local.getByText(localFallback, { exact: true })).toBeVisible();
  await expect(page.getByTestId("route-loading")).toBeHidden();
  await expect(page.getByRole("region", { exact: true, name: "ルート境界" })).toBeVisible();
  await expect(update).toBeVisible();
  await expect(local.getByText(`更新 ${attempt} 完了（2秒）`, { exact: true })).toBeVisible();
};

test("urgent interaction with a local boundary only replaces that result and can be repeated", async ({
  page,
}) => {
  await page.getByRole("link", { name: interactionLink }).click();
  const local = page.getByRole("region", { exact: true, name: "ローカル境界" });
  await expectUrgentLocalChange(page, local, firstAttempt);
  await expectUrgentLocalChange(page, local, secondAttempt);
});

const boundaries = ["ルート境界", "ローカル境界"];
boundaries.forEach((name) => {
  test(`transition in ${name} retains revealed content rather than showing a fallback`, async ({
    page,
  }) => {
    await page.getByRole("link", { name: interactionLink }).click();
    const region = page.getByRole("region", { exact: true, name });
    await region.getByRole("button", { exact: true, name: "Transition 更新（2秒）" }).click();
    await expect(region.getByRole("status")).toHaveText("Transition 待機中：前の結果を保持");
    await expect(region.getByText("初期結果（待機なし）", { exact: true })).toBeVisible();
    await expect(page.getByTestId("route-loading")).toBeHidden();
    await expect(page.getByText(localFallback, { exact: true })).toBeHidden();
    await expect(region.getByText("更新 1 完了（2秒）", { exact: true })).toBeVisible();
    await expect(region.getByRole("status")).toHaveText("操作できます");
  });
});

const expectNarrowStages = async (page: Page): Promise<void> => {
  await expect(page.getByText(completedChild, { exact: true })).toBeVisible();
  await expect(page.getByText(/サーバー UTC：開始/u)).toHaveCount(stageTimingCount);
};

const expectNarrowInteraction = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("interaction-page")).toBeVisible();
};

const narrowCases = [
  { destination: stagesLink, verifyContent: expectNarrowStages },
  { destination: interactionLink, verifyContent: expectNarrowInteraction },
];
narrowCases.forEach(({ destination, verifyContent }) => {
  test(`${destination} stays readable on a narrow viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize(narrowViewport);
    await page.getByRole("link", { name: destination }).click();
    await verifyContent(page);
    await expect(page.getByTestId("loading-layout")).toHaveCSS(
      "background-color",
      "oklch(0.932 0.032 255.585)",
    );
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(narrowViewport.width);
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("loading-mobile.png") });
  });
});

test("plain links navigate without JavaScript", async ({ baseURL, browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL("/loading", baseURL).href);
    await page.getByRole("link", { name: navigationLink }).click();
    await expect(page).toHaveURL(/\/loading\/navigation$/u);
    await page.waitForLoadState("load");
  } finally {
    await context.close();
  }
});

test("without navigation precommit a plain link uses a document navigation and resets layout state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "NavigationPrecommitController", { value: undefined });
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await countLayout(page);
  await page.getByRole("link", { name: navigationLink }).click();
  await expect(page).toHaveURL(/\/loading\/navigation$/u);
  await expect(page.getByRole("heading", { name: destinationHeading })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Count: 0" })).toBeVisible();
});
