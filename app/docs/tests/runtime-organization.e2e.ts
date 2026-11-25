import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const httpStatusPermanentRedirect = 308;
const noRedirects = 0;
const noMatches = 0;
const singleLink = 1;
const sampleCount = 4;
const bookmarkSuffix = "?from=bookmark";
const executionPath = "/advanced/server-function-execution-and-refresh";
const lifetimePath = "/advanced/request-runtime-and-lifetimes";
const securityPath = "/best-practices/authentication-and-authorization";
const testingPath = "/best-practices/testing";

type Bookmark = Readonly<{ accept: string; destination: string; source: string }>;

const expectRetiredRedirect = async (
  request: APIRequestContext,
  { accept, destination, source }: Bookmark,
  method: string,
): Promise<void> => {
  const response = await request.fetch(source, {
    headers: { Accept: accept },
    maxRedirects: noRedirects,
    method,
  });
  expect(response.status()).toBe(httpStatusPermanentRedirect);
  expect(response.headers()["location"]).toBe(destination);
  expect(await response.body()).toHaveLength(noMatches);
};

["", "/en", "/ja"].forEach((prefix) => {
  const retired = `${prefix}/advanced`;
  const source = `${retired}${bookmarkSuffix}`;
  const destination = `${prefix}${executionPath}${bookmarkSuffix}#execution`;
  ["text/html", "text/x-component"].forEach((accept) => {
    test(`retired runtime overview ${prefix || "legacy"} redirects ${accept}`, async ({
      request,
    }) => {
      const bookmark = { accept, destination, source };
      await expectRetiredRedirect(request, bookmark, "GET");
      await expectRetiredRedirect(request, bookmark, "HEAD");
    });
  });
  test.describe(`retired runtime bookmark ${prefix || "legacy"}`, () => {
    test.use({ javaScriptEnabled: false });
    test("maps the old chapters anchor to execution", async ({ page }) => {
      await page.goto(`${source}#chapters`);
      await expect(page).toHaveURL(destination);
      await expect(page.locator("article #execution")).toBeInViewport();
      await expect(page.locator(`a[href="${retired}"]`)).toHaveCount(noMatches);
    });
  });
});

const locales = ["en", "ja"] as const;
type Locale = (typeof locales)[number];

const groupLink = (page: Page, group: string, href: string): Locator =>
  page.getByRole("list", { exact: true, name: group }).locator(`:scope > li > a[href="${href}"]`);

const headings = async (page: Page): Promise<string[]> =>
  page.locator("article h2").evaluateAll((items) => items.map((heading) => heading.id));

const expectSidebarGroups = async (page: Page, locale: Locale): Promise<void> => {
  await Promise.all(
    ["Runtime behavior", "実行時の契約"].map(async (name) =>
      expect(page.getByRole("list", { exact: true, name })).toHaveCount(noMatches),
    ),
  );
  await expect(page.locator(`a[href="/${locale}/advanced"]`)).toHaveCount(noMatches);
  await expect(groupLink(page, "Best practices", `/${locale}${lifetimePath}`)).toHaveCount(
    singleLink,
  );
  await expect(groupLink(page, "Best practices", `/${locale}${testingPath}`)).toHaveCount(
    singleLink,
  );
  await expect(groupLink(page, "Guides", `/${locale}${executionPath}`)).toHaveCount(singleLink);
};

const expectSecurityGuide = async (page: Page, locale: Locale): Promise<void> => {
  const security = `/${locale}${securityPath}`;
  await groupLink(page, "Best practices", security).click();
  await expect(page).toHaveURL(security);
  await expect(page.locator("article h1")).toHaveText(
    locale === "en" ? "Authentication and authorization" : "認証と認可",
  );
  expect(await headings(page)).toEqual(["entry-points", "shared-policy", "authorization"]);
  await expect(page.locator("article")).not.toContainText("10,000");
  await expect(page.locator("article")).not.toContainText("10 MiB");
};

const expectLifetimeGuide = async (page: Page, locale: Locale): Promise<void> => {
  const lifetimes = `/${locale}${lifetimePath}`;
  await groupLink(page, "Best practices", lifetimes).click();
  await expect(page).toHaveURL(lifetimes);
  await expect(page.locator("article h1")).toHaveText(
    locale === "en" ? "Manage service lifetimes" : "サービスの生存期間を管理する",
  );
  expect(await headings(page)).toEqual(["resource-design", "request-layer", "response-lifetime"]);
  await expect(page.locator("article #render-scope")).toBeAttached();
};

const expectTestingGuide = async (page: Page, locale: Locale): Promise<void> => {
  const testing = `/${locale}${testingPath}`;
  await groupLink(page, "Best practices", testing).click();
  await expect(page).toHaveURL(testing);
  expect(await headings(page)).toEqual(["tools", "routes", "pages", "layouts", "server-functions"]);
  await expect(page.locator("article #production")).toBeAttached();
  await expect(page.locator("article #services")).toBeAttached();
  await expect(page.locator("article pre code")).toHaveCount(sampleCount);
};

const expectExecutionGuide = async (page: Page, locale: Locale): Promise<void> => {
  await page.goto(`/${locale}/api-reference/server-functions#request-protocol`);
  await expect(page.locator("article h2#request-protocol")).toBeInViewport();
  await Promise.all(
    ["400", "403", "413", "500"].map(async (status) =>
      expect(page.locator("article")).toContainText(status),
    ),
  );

  const execution = `/${locale}${executionPath}`;
  await groupLink(page, "Guides", execution).click();
  await expect(page).toHaveURL(execution);
  await expect(page.locator("article")).not.toContainText("10 MiB");
  await expect(page.locator("article")).not.toContainText("Origin");
  expect(await headings(page)).toEqual(["execution", "result-and-refresh", "concurrency"]);
  await expect(page.locator("article #input-boundary")).toBeAttached();
};

locales.forEach((locale) => {
  test(`${locale} reader finds authentication, resource ownership and testing under Best practices`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await expectSidebarGroups(page, locale);
    await expectSecurityGuide(page, locale);
    await expectLifetimeGuide(page, locale);
    await expectTestingGuide(page, locale);
    await expectExecutionGuide(page, locale);
  });
});
