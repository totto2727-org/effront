import { expect, test } from "@playwright/test";
import { buildHeaders } from "./cache-headers";

for (const prefix of ["", "/en", "/ja"]) {
  const target = `${prefix}/advanced/server-function-execution-and-refresh`;
  for (const accept of ["text/html", "text/x-component"]) {
    test(`retired runtime overview ${prefix || "legacy"} redirects ${accept}`, async ({
      request,
    }) => {
      for (const method of ["GET", "HEAD"]) {
        const response = await request.fetch(`${prefix}/advanced?from=bookmark`, {
          method,
          headers: { ...(await buildHeaders(request)), Accept: accept },
          maxRedirects: 0,
        });
        expect(response.status()).toBe(308);
        expect(response.headers()["location"]).toBe(`${target}?from=bookmark#execution`);
        expect(await response.body()).toHaveLength(0);
      }
    });
  }
  test.describe(`retired runtime bookmark ${prefix || "legacy"}`, () => {
    test.use({ javaScriptEnabled: false });
    test("maps the old chapters anchor to execution", async ({ page }) => {
      await page.goto(`${prefix}/advanced?from=bookmark#chapters`);
      await expect(page).toHaveURL(`${target}?from=bookmark#execution`);
      await expect(page.locator("article #execution")).toBeInViewport();
      await expect(page.locator(`a[href="${prefix}/advanced"]`)).toHaveCount(0);
    });
  });
}

for (const locale of ["en", "ja"] as const) {
  test(`${locale} reader finds authentication, resource ownership and testing under Best practices`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const practices = page.getByRole("list", { name: "Best practices", exact: true });
    const guides = page.getByRole("list", { name: "Guides", exact: true });
    const security = `/${locale}/best-practices/authentication-and-authorization`;
    const lifetimes = `/${locale}/advanced/request-runtime-and-lifetimes`;
    const testing = `/${locale}/best-practices/testing`;
    const execution = `/${locale}/advanced/server-function-execution-and-refresh`;
    for (const group of ["Runtime behavior", "実行時の契約"]) {
      await expect(page.getByRole("list", { name: group, exact: true })).toHaveCount(0);
    }
    await expect(page.locator(`a[href="/${locale}/advanced"]`)).toHaveCount(0);
    await expect(practices.locator(`:scope > li > a[href="${lifetimes}"]`)).toHaveCount(1);
    await expect(practices.locator(`:scope > li > a[href="${testing}"]`)).toHaveCount(1);
    await expect(guides.locator(`:scope > li > a[href="${execution}"]`)).toHaveCount(1);
    await practices.locator(`:scope > li > a[href="${security}"]`).click();
    await expect(page).toHaveURL(security);
    await expect(page.locator("article h1")).toHaveText(
      locale === "en" ? "Authentication and authorization" : "認証と認可",
    );
    expect(
      await page.locator("article h2").evaluateAll((headings) => headings.map((h) => h.id)),
    ).toEqual(["entry-points", "shared-policy", "authorization"]);
    await expect(page.locator("article")).not.toContainText("10,000");
    await expect(page.locator("article")).not.toContainText("10 MiB");
    await practices.locator(`:scope > li > a[href="${lifetimes}"]`).click();
    await expect(page).toHaveURL(lifetimes);
    await expect(page.locator("article h1")).toHaveText(
      locale === "en" ? "Manage service lifetimes" : "サービスの生存期間を管理する",
    );
    expect(
      await page.locator("article h2").evaluateAll((headings) => headings.map((h) => h.id)),
    ).toEqual(["resource-design", "request-layer", "response-lifetime"]);
    await expect(page.locator("article #render-scope")).toBeAttached();
    await practices.locator(`:scope > li > a[href="${testing}"]`).click();
    await expect(page).toHaveURL(testing);
    expect(
      await page.locator("article h2").evaluateAll((headings) => headings.map((h) => h.id)),
    ).toEqual(["tools", "routes", "pages", "layouts", "server-functions"]);
    await expect(page.locator("article #production")).toBeAttached();
    await expect(page.locator("article #services")).toBeAttached();
    await expect(page.locator("article pre code")).toHaveCount(4);
    await page.goto(`/${locale}/api-reference/server-functions#request-protocol`);
    await expect(page.locator("article h2#request-protocol")).toBeInViewport();
    for (const status of ["400", "403", "413", "500"]) {
      await expect(page.locator("article")).toContainText(status);
    }
    await guides.locator(`:scope > li > a[href="${execution}"]`).click();
    await expect(page).toHaveURL(execution);
    await expect(page.locator("article")).not.toContainText("10 MiB");
    await expect(page.locator("article")).not.toContainText("Origin");
    expect(
      await page.locator("article h2").evaluateAll((headings) => headings.map((h) => h.id)),
    ).toEqual(["execution", "result-and-refresh", "concurrency"]);
    await expect(page.locator("article #input-boundary")).toBeAttached();
  });
}
