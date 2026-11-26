import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { articleMetadata } from "./docs-catalog.fixture.ts";

const markdownLinks = 2;
const firstSidebarOffset = 350;
const latestSidebarOffset = 180;
const pageTop = 0;
const minimumHeadingScroll = 100;
const mobileViewport = { height: 844, width: 390 };

const followMarkdownLinks = async (page: Page, sidebar: Locator): Promise<void> => {
  await expect(sidebar.getByRole("link")).toHaveCount(markdownLinks);
  await sidebar.locator('a[href="/guide/markdown"]').click();
  await expect(page).toHaveURL(/\/guide\/markdown$/u);
  await expect(page.locator("article h1")).toHaveText(articleMetadata("/guide/markdown").title);
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText(
    articleMetadata("/guide/markdown").title,
  );
  await page.locator('article a[href="/api-reference/markdown"]').click();
  await expect(page).toHaveURL(/\/api-reference\/markdown$/u);
  await expect(page.getByRole("navigation", { name: "パンくずリスト" })).toContainText(
    articleMetadata("/api-reference/markdown").title,
  );
};

const revisitMarkdownArticles = async (page: Page): Promise<void> => {
  await page.goBack();
  await expect(page).toHaveURL(/\/guide\/markdown$/u);
  await page.goForward();
  await expect(page).toHaveURL(/\/api-reference\/markdown$/u);
};

const openSearch = async (page: Page): Promise<Locator> => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  return page.getByRole("textbox", { name: "ガイドを絞り込む" });
};

test("Markdown search and shell persist across sidebar, article and history navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const search = await openSearch(page);
  const searchNode = await search.elementHandle();
  await search.fill("Markdown");
  await followMarkdownLinks(page, page.locator('[data-slot="sidebar-content"]'));
  await revisitMarkdownArticles(page);
  await expect(search).toHaveValue("Markdown");
  expect(await searchNode.evaluate((node) => node.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});

const setSidebarOffset = async (sidebar: Locator, offset: number): Promise<number> =>
  sidebar.evaluate((node, top) => {
    node.scrollTop = top;
    return node.scrollTop;
  }, offset);

const expectSidebarOffset = async (sidebar: Locator, offset: number): Promise<void> => {
  await expect.poll(async () => sidebar.evaluate((node) => node.scrollTop)).toBe(offset);
};

const revisitPlatforms = async (page: Page, sidebar: Locator): Promise<void> => {
  const latest = await setSidebarOffset(sidebar, latestSidebarOffset);
  await page.goBack();
  await expect(page).toHaveURL(/\/platforms\/bun$/u);
  await expectSidebarOffset(sidebar, latest);
  await page.goForward();
  await expect(page).toHaveURL(/\/platforms\/alchemy$/u);
  await expectSidebarOffset(sidebar, latest);
};

const followPlatformLinks = async (
  page: Page,
  sidebar: Locator,
  {
    node,
    offset,
  }: Readonly<{ node: Awaited<ReturnType<Locator["elementHandle"]>>; offset: number }>,
): Promise<void> => {
  await page.locator('article a[href="/platforms/bun"]').click();
  await expect(page).toHaveURL(/\/platforms\/bun$/u);
  await expectSidebarOffset(sidebar, offset);
  expect(await node.evaluate((element) => element.isConnected)).toBe(true);
  await page.getByRole("navigation", { name: "前後のページ" }).getByRole("link").last().click();
  await expect(page).toHaveURL(/\/platforms\/alchemy$/u);
  await expectSidebarOffset(sidebar, offset);
};

test("sidebar DOM and latest scroll position survive article, previous-next and history navigation", async ({
  page,
}) => {
  await page.goto("/platforms");
  await page.waitForLoadState("networkidle");
  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const sidebarNode = await sidebar.elementHandle();
  const offset = await setSidebarOffset(sidebar, firstSidebarOffset);
  expect(offset).toBeGreaterThan(pageTop);
  await followPlatformLinks(page, sidebar, { node: sidebarNode, offset });
  await revisitPlatforms(page, sidebar);
  expect(await sidebarNode.evaluate((node) => node.isConnected)).toBe(true);
});

const expectKeyboardAccessibleCode = async (page: Page): Promise<void> => {
  const code = page
    .locator("article pre[data-code-block]")
    .filter({ hasText: "export default EFFRONT.make({ routes })" });
  await expect(code).toHaveAttribute("tabindex", "0");
  await expect(code).toContainText('import { Application } from "@effront/core";');
  const token = code.locator('span[style*="--shiki-dark"]').first();
  await expect(token).toBeAttached();
  expect(await token.evaluate((node) => getComputedStyle(node).color)).not.toBe("rgb(0, 0, 0)");
  await code.focus();
  await expect(code).toBeFocused();
};

test("Markdown headings scroll natively and highlighted code remains selectable and keyboard reachable", async ({
  page,
}) => {
  await page.goto("/guide/routes");
  await page
    .getByRole("complementary", { name: "このページ内" })
    .locator('a[href="#application"]')
    .click();
  await expect(page).toHaveURL(/#application$/u);
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(minimumHeadingScroll);
  await expectKeyboardAccessibleCode(page);
});

const openMobileMarkdown = async (page: Page): Promise<void> => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "ガイドを絞り込む" }).fill("Markdown");
  await dialog.locator('a[href="/guide/markdown"]').click();
  await expect(page).toHaveURL(/\/guide\/markdown$/u);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("article h1")).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(mobileViewport.width);
};

const waitForArticleTransition = async (page: Page): Promise<void> => {
  // Wait before taking a full-page screenshot so it includes the complete destination article.
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().map(async (animation) => animation.finished));
  });
};

const expectMobileAuthoringAnchor = async (page: Page): Promise<void> => {
  const finalSection = page.locator("article #authoring");
  await finalSection.scrollIntoViewIfNeeded();
  await expect(finalSection).toBeInViewport();
  await page.goto("/guide/markdown#authoring");
  await expect(page).toHaveURL(/#authoring$/u);
  await expect(finalSection).toBeInViewport();
};

test("mobile navigation opens a Markdown page without horizontal document overflow", async ({
  page,
}) => {
  await openMobileMarkdown(page);
  await waitForArticleTransition(page);
  await expectMobileAuthoringAnchor(page);
  await expect(page.locator("article")).toContainText(
    /追加プラグイン[^。]*標準プラグインの後[^。]*置き換えるものではありません/u,
  );
  await page.screenshot({ path: "tmp/docs-mobile-authoring.png" });
  await page.screenshot({ fullPage: true, path: "tmp/docs-mobile.png" });
});
