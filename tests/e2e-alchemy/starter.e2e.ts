import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:4395";

test("starter Worker Layer serves the minimal application without deployment services", async ({
  page,
}) => {
  const response = await page.goto(origin);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Hello, world");
  await expect(page.getByRole("heading", { name: "Hello, world", exact: true })).toBeVisible();
});

test("starter Worker Layer retains HEAD handling", async ({ request }) => {
  const response = await request.head(origin);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(await response.body()).toHaveLength(0);
});
