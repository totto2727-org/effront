import { expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";

import {
  observeArticleTransition,
  verifyArticleTransition,
} from "./article-transition.browser.fixture.ts";
import {
  articleHeadingLinks,
  expectArticleTitle,
  expectHeadingAnchors,
  expectNoHorizontalOverflow,
  expectUnclippedSidebarLabels,
  headingSelector,
  manualArticle,
  manualRoutes,
  requireHref,
  visibleSidebar,
} from "./layout-assertions.browser.fixture.ts";
import { layoutTest as test } from "./layout-host.fixture.ts";
import {
  expectCurrentDocument,
  expectLatestSidebarScroll,
  expectRetainedSidebar,
  startSidebarRetention,
  visibleSidebarDestination,
} from "./sidebar-retention.browser.fixture.ts";

type Retention = Awaited<ReturnType<typeof startSidebarRetention>>;
type ManualRoute = (typeof manualRoutes)[number];
type ArticleHistory = Readonly<{ contentPath: string; nextPath: string }>;

const httpStatusOk = 200;
const singleSidebarResult = 1;
const noSidebarResults = 0;
const anchorScrollMinimum = 100;
const viewportTop = 0;
const visibleHeadingLimit = 220;
const pageTopTolerance = 1;
const navigationViewport = { height: 420, width: 1440 };
const mobileViewport = { height: 844, width: 390 };

const expectSidebarDestinations = async (sidebar: Locator): Promise<void> => {
  await Promise.all(
    manualRoutes.map(async ({ path, title }) => {
      const link = sidebar.getByRole("link", { exact: true, name: title });
      await expect(link).toHaveAttribute("href", path);
    }),
  );
};

const expectStaticArticle = async (page: Page, { path, title }: ManualRoute): Promise<void> => {
  const response = await page.goto(path);
  expect(response?.status()).toBe(httpStatusOk);
  const article = manualArticle(page);
  await expect(article).toHaveAttribute("data-doc-page", path);
  await expectArticleTitle(article, title);
  expect(await page.title()).toContain(title);
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", path);
  await expectSidebarDestinations(sidebar);
};

test.describe("documentation shell without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  manualRoutes.forEach((route) => {
    test(`renders article, navigation and heading anchors for ${route.title}`, async ({ page }) => {
      await expectStaticArticle(page, route);
      await expectHeadingAnchors(page);
      await expectNoHorizontalOverflow(page);
    });
  });
});

const expectOnlyUnicodeResult = async (sidebar: Locator, filter: Locator): Promise<void> => {
  await filter.fill("Unicode");
  await expect(sidebar.locator('a[data-sidebar="menu-button"]')).toHaveCount(singleSidebarResult);
  await expect(sidebar.getByRole("link", { exact: true, name: "Unicode page" })).toBeVisible();
};

const expectSearchRecovery = async (sidebar: Locator, filter: Locator): Promise<void> => {
  const results = sidebar.locator('a[data-sidebar="menu-button"]');
  await filter.fill("no-matching-document");
  await expect(results).toHaveCount(noSidebarResults);
  await filter.fill("");
  await expect(results).toHaveCount(manualRoutes.length);
};

test("filters sidebar links and recovers from an empty search result", async ({ page }) => {
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  const sidebar = visibleSidebar(page);
  const filter = sidebar.getByRole("textbox", { name: "ガイドを絞り込む" });
  await expectOnlyUnicodeResult(sidebar, filter);
  await expectSearchRecovery(sidebar, filter);
  await expectUnclippedSidebarLabels(sidebar);
});

const verifySidebarNavigation = async (
  page: Page,
  retention: Retention,
  testInfo: TestInfo,
): Promise<void> => {
  // Choose an already visible link so auto-scrolling cannot mask a sidebar scroll reset.
  const destination = await visibleSidebarDestination(retention);
  const evidence = await observeArticleTransition(page);
  await page.mouse.click(destination.x, destination.y);
  await expectCurrentDocument(page, retention, destination.path);
  await verifyArticleTransition(page, evidence, { destination: destination.path, testInfo });
  await expectRetainedSidebar(retention);
};

const clickDocumentLink = async (link: Locator, message: string): Promise<string> => {
  const path = await requireHref(link, message);
  await link.click();
  return path;
};

const expectDocumentAtTop = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeLessThanOrEqual(pageTopTolerance);
};

const verifyArticleLinks = async (page: Page, retention: Retention): Promise<ArticleHistory> => {
  const contentLink = manualArticle(page).locator('a[href^="/manual"]').first();
  const contentPath = await clickDocumentLink(
    contentLink,
    "Expected a substantive in-article documentation link",
  );
  await expectCurrentDocument(page, retention, contentPath);
  await expectDocumentAtTop(page);
  const pagination = page.getByRole("navigation", { name: "前後のページ" });
  const nextLink = pagination.getByRole("link", { name: /次のページ/u });
  const nextPath = await clickDocumentLink(nextLink, "Expected a next article link");
  await expectCurrentDocument(page, retention, nextPath);
  await expectDocumentAtTop(page);
  return { contentPath, nextPath };
};

const verifyArticleHistory = async (
  page: Page,
  retention: Retention,
  { contentPath, nextPath }: ArticleHistory,
): Promise<void> => {
  const pagination = page.getByRole("navigation", { name: "前後のページ" });
  await pagination.getByRole("link", { name: /前のページ/u }).click();
  await expectCurrentDocument(page, retention, contentPath);
  await pagination.getByRole("link", { name: /次のページ/u }).click();
  await expectCurrentDocument(page, retention, nextPath);
  await expectLatestSidebarScroll(retention);
  await page.goBack();
  await expectCurrentDocument(page, retention, contentPath);
  await page.goForward();
  await expectCurrentDocument(page, retention, nextPath);
};

const verifyArticleAnchorScroll = async (page: Page, retention: Retention): Promise<void> => {
  const anchor = articleHeadingLinks(page).last();
  const hash = await clickDocumentLink(anchor, "Expected an article heading link");
  await expect.poll(() => new URL(page.url()).hash).toBe(hash);
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(anchorScrollMinimum);
  const heading = manualArticle(page).locator(headingSelector(hash));
  const headingTop = async (): Promise<number> =>
    heading.evaluate((node) => node.getBoundingClientRect().top);
  await expect.poll(headingTop).toBeGreaterThanOrEqual(viewportTop);
  await expect.poll(headingTop).toBeLessThan(visibleHeadingLimit);
  await expectRetainedSidebar(retention);
};

test("preserves sidebar DOM, scroll and search while only articles transition across navigation and history", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(navigationViewport);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  const retention = await startSidebarRetention(page);
  await verifySidebarNavigation(page, retention, testInfo);
  const history = await verifyArticleLinks(page, retention);
  await verifyArticleHistory(page, retention, history);
  await verifyArticleAnchorScroll(page, retention);
});

const verifyMobileSidebarDismissal = async (page: Page): Promise<void> => {
  const toggle = page.getByRole("button", { exact: true, name: "Toggle Sidebar" });
  await toggle.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expectUnclippedSidebarLabels(sheet);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(sheet).toBeVisible();
};

const navigateFromMobileSidebar = async (page: Page): Promise<void> => {
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("link", { exact: true, name: "Markdown manual" }).click();
  await expect(page).toHaveURL(/\/manual$/u);
  await expect(sheet).toBeHidden();
  await expectArticleTitle(manualArticle(page), "Markdown manual");
};

const expectAllManualRoutesFitMobile = async (page: Page): Promise<void> => {
  const verify = async ({ path, title }: ManualRoute): Promise<void> => {
    await page.goto(path);
    await expectArticleTitle(manualArticle(page), title);
    await expectNoHorizontalOverflow(page);
  };
  // oxlint-disable-next-line rules/no-for-loops -- Each navigation and measurement owns the same browser page.
  for (const route of manualRoutes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Finish the current page's measurement before navigating away.
    await verify(route);
  }
};

test("supports mobile sidebar keyboard dismissal and link dismissal without overflow", async ({
  page,
}) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/manual/guide/getting-started");
  await page.waitForLoadState("networkidle");
  await expectNoHorizontalOverflow(page);
  await verifyMobileSidebarDismissal(page);
  await navigateFromMobileSidebar(page);
  await expectAllManualRoutesFitMobile(page);
});
