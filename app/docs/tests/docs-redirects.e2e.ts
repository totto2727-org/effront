import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { articleMetadata } from "./docs-catalog.fixture.ts";

const httpStatusOk = 200;
const httpStatusPermanentRedirect = 308;
const httpStatusNotFound = 404;
const noBody = 0;
const noRedirects = 0;
const noMatches = 0;
const flightMedia = "text/x-component";
const bookmarkQuery = "?from=bookmark";
const startupPath = "/advanced/production-startup";

const removedRoutes = [
  "/not-a-document",
  "/index",
  "/reading/overview",
  "/advanced/production-startup-extra",
  "/guide/testing-extra",
];

const retiredRoutes = [
  { canonical: "/platforms", retired: "/platforms/node-bun" },
  { canonical: "/platforms", retired: startupPath },
  { canonical: "/best-practices/testing", retired: "/guide/testing" },
];

const expectHtmlAndFlight404 = async (request: APIRequestContext, slug: string): Promise<void> => {
  const html = await request.get(slug);
  expect(html.status()).toBe(httpStatusNotFound);
  const flight = await request.get(slug, { headers: { Accept: flightMedia } });
  expect(flight.status()).toBe(httpStatusNotFound);
};

test("unknown and historical removed routes return real HTML and Flight 404 responses", async ({
  request,
}) => {
  // Keep requests serial so the build host never renders several missing routes at once.
  // oxlint-disable-next-line rules/no-for-loops -- Check both content types for each slug before requesting the next slug.
  for (const slug of removedRoutes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep each HTML and Flight request pair serial.
    await expectHtmlAndFlight404(request, slug);
  }
});

const expectRedirect = async (response: APIResponse, location: string): Promise<void> => {
  expect(response.status()).toBe(httpStatusPermanentRedirect);
  expect(response.headers()["location"]).toBe(location);
  expect(await response.body()).toHaveLength(noBody);
};

const expectFollowedRedirect = async (
  response: APIResponse,
  canonical: string,
  accept: string,
): Promise<void> => {
  expect(response.status()).toBe(httpStatusOk);
  expect(new URL(response.url()).pathname).toBe(canonical);
  expect(response.headers()["content-type"]).toContain(accept);
  expect(await response.text()).toContain(articleMetadata(canonical).title);
};

retiredRoutes.forEach(({ canonical, retired }) => {
  ["text/html", flightMedia].forEach((accept) => {
    test(`${retired} redirects ${accept} to ${canonical}`, async ({ request }) => {
      const bookmark = `${retired}${bookmarkQuery}`;
      const location = `${canonical}${bookmarkQuery}`;
      const headers = { Accept: accept };
      const redirect = await request.get(bookmark, { headers, maxRedirects: noRedirects });
      await expectRedirect(redirect, location);
      const head = await request.head(bookmark, { headers, maxRedirects: noRedirects });
      await expectRedirect(head, location);
      const followed = await request.get(bookmark, { headers });
      await expectFollowedRedirect(followed, canonical, accept);
    });
  });
});

test.describe("testing bookmark without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("keeps the production anchor under Best practices", async ({ page }) => {
    await page.goto("/guide/testing?from=bookmark#production");
    await expect(page).toHaveURL(/\/best-practices\/testing\?from=bookmark#production$/u);
    await expect(page.locator("article")).toHaveAttribute(
      "data-doc-page",
      "/best-practices/testing",
    );
    await expect(page.locator("article header")).toContainText("Best practices");
    await expect(page.locator("article #production")).toBeInViewport();
    await expect(page.locator('a[href^="/guide/testing"]')).toHaveCount(noMatches);
  });
});

test.describe("retired startup bookmark without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("lands on Platforms without advertising the retired article", async ({ page }) => {
    await page.goto(startupPath);
    await expect(page).toHaveURL(/\/platforms$/u);
    await expect(page.locator("article")).toHaveAttribute("data-doc-page", "/platforms");
    await expect(page.locator('a[href*="production-startup"]')).toHaveCount(noMatches);
    await expect(page.locator("article h2#support")).toBeVisible();
    await expect(page.locator('article a[href="/platforms/bun"]')).toBeVisible();
  });
});

const followStartupBookmark = async (page: Page): Promise<void> => {
  // Simulate an inbound bookmark without putting its URL back in the authored navigation.
  await page.locator("article").evaluate((article, href) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = "Legacy production setup";
    article.append(link);
  }, startupPath);
  const flight = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/platforms" &&
      response.headers()["content-type"]?.includes(flightMedia) === true,
  );
  await page.locator(`article a[href="${startupPath}"]`).click();
  const response = await flight;
  expect(response.status()).toBe(httpStatusOk);
};

test("native Flight navigation follows the retired URL while preserving the shell", async ({
  page,
}) => {
  await page.goto("/best-practices/testing");
  await page.waitForLoadState("networkidle");
  const search = await page.getByRole("textbox", { name: "ガイドを絞り込む" }).elementHandle();
  await followStartupBookmark(page);
  await expect(page).toHaveURL(/\/platforms$/u);
  await expect(page.locator("article")).toHaveAttribute("data-doc-page", "/platforms");
  expect(await search.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.locator('a[href*="production-startup"]')).toHaveCount(noMatches);
});

["", "/en", "/ja"].forEach((prefix) => {
  test.describe(`retired native-host bookmarks ${prefix || "unprefixed"}`, () => {
    test.use({ javaScriptEnabled: false });
    ["setup", "entries", "assets", "node", "bun"].forEach((fragment) => {
      test(`preserves the ${fragment} anchor and query with both host choices`, async ({
        page,
      }) => {
        await page.goto(`${prefix}/platforms/node-bun${bookmarkQuery}#${fragment}`);
        await expect(page).toHaveURL(`${prefix}/platforms${bookmarkQuery}#${fragment}`);
        await expect(page.locator(`article #${fragment}`)).toBeAttached();
        await Promise.all(
          ["node", "bun"].map(async (host) =>
            expect(page.locator(`article a[href="${prefix}/platforms/${host}"]`)).toBeVisible(),
          ),
        );
        await expect(page.locator('a[href*="node-bun"]')).toHaveCount(noMatches);
      });
    });
  });
});
