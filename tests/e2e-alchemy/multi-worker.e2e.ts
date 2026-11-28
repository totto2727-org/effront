import { expect, test } from "@playwright/test";

for (const { name, heading, port } of [
  { name: "storefront", heading: "Storefront", port: 4396 },
  { name: "backoffice", heading: "Backoffice", port: 4397 },
]) {
  test(`the shared Workers module serves the ${heading} Layer and application`, async ({
    page,
    request,
  }) => {
    const origin = `http://127.0.0.1:${port}`;
    const response = await page.goto(origin);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-worker"]).toBe(name);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();

    const clientScript = page.locator('link[rel="modulepreload"]').first();
    await expect(clientScript).toHaveAttribute("href", /^\/assets\/.+\.js$/);
    const asset = await request.get(
      new URL((await clientScript.getAttribute("href")) ?? "", origin).href,
    );
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("javascript");
  });
}
