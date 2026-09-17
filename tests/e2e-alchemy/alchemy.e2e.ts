import { expect, test } from "@playwright/test";

test("Alchemy Website Worker serves KV-backed RSC, hydration, Server Functions and navigation", async ({
  page,
  request,
}) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Hello from Alchemy KV");
  const head = await request.head("/");
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  // SSR can expose the button before the development client modules finish loading.
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("kv-greeting")).toHaveText("Hello from Alchemy KV");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
  await expect(page.getByTestId("action-greeting")).toHaveText("Hello from Alchemy KV, Ada!");
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId("label")).toHaveText("Effront + Alchemy");
  expect(errors).toEqual([]);
});
