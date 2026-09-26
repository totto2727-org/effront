import { expect, test } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:4394" });

test("Alchemy Loading homepage navigates through the slow route to its completed page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("link", { name: "実験室を開く" }).click();
  await expect(page).toHaveURL(/\/loading$/);
  await expect(page.getByTestId("loading-layout")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "同じ「待つ」でも境界で見え方が変わる" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "1. リンクで2秒待つ" }).click();
  await expect(page.getByTestId("route-loading")).toBeVisible();
  await expect(page).toHaveURL(/\/loading\/navigation$/);
  await expect(page.getByRole("heading", { name: "リンク先のページが完成（2秒）" })).toBeVisible();
  await expect(page.getByTestId("loading-layout")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Alchemy Loading query route fetches the public asset after browser interaction", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/loading/query");
  await expect(
    page.getByRole("heading", { name: "子が取得する useSuspenseQuery（各2秒）" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "開始（ブラウザーで取得）" }).click();
  await expect(page.getByTestId("query-fallback")).toBeVisible();
  await expect(page.getByTestId("query-result")).toHaveText(
    "項目 1：ブラウザーから取得した静的サンプルです。",
  );
  expect(errors).toEqual([]);
});
