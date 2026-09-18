import { expect, test } from "@playwright/test";
import { articleCatalog } from "../src/content/catalog";
import { corePages, coreSources } from "../src/content/core";
import { architectureBaseline } from "../src/content/architecture-baseline";

const pages = [...articleCatalog, ...corePages];

test.describe("built documentation without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  for (const article of pages) {
    test(`${article.slug} serves its article, navigation, anchors and styles`, async ({ page }) => {
      const response = await page.goto(article.slug);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(`${article.title} | Effront`);
      await expect(page.locator("html")).toHaveClass("dark");
      await expect(page.locator("article h1")).toHaveText(article.title);
      await expect(page.locator("article")).toHaveAttribute("data-doc-page", article.slug);
      await expect(
        page.getByRole("navigation", { name: "ドキュメントナビゲーション" }).getByRole("link"),
      ).toHaveCount(pages.length);
      for (const heading of article.headings) {
        await expect(page.locator(`article #${heading.id}`)).toHaveText(heading.title);
      }
      await expect(page.locator("article h1")).toHaveCSS("font-size", "36px");
      if (article.section === "アーキテクチャ") {
        await expect(page.locator("[data-architecture-baseline]")).toHaveAttribute(
          "data-architecture-baseline",
          architectureBaseline.commit,
        );
        await expect(page.locator("[data-architecture-baseline]")).toContainText(
          architectureBaseline.version,
        );
        for (const excerpt of await page.locator("[data-core-source]").all()) {
          const path = await excerpt.getAttribute("data-core-source");
          const selections = coreSources.filter((candidate) => candidate.path === path);
          expect(selections.length).toBeGreaterThan(0);
          // A source file can have several authored selections. Match the exact
          // text against that file's selections, not just the first selection.
          expect(selections.map((source) => source.code)).toContain(
            await excerpt.locator("pre code").textContent(),
          );
        }
      }
    });
  }
});

test("Markdown search and shell persist across sidebar, article and history navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const search = page.getByRole("textbox", { name: "ガイドを絞り込む" });
  const searchNode = await search.elementHandle();
  await search.fill("Markdown");
  const sidebar = page.locator('[data-slot="sidebar-content"]');
  await expect(sidebar.getByRole("link")).toHaveCount(2);
  await sidebar.getByRole("link", { name: "Markdown で記事を書く", exact: true }).click();
  await expect(page).toHaveURL(/\/guide\/markdown$/);
  await expect(page.locator("article h1")).toHaveText("Markdown で記事を書く");
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText("Markdown で記事を書く");
  await page.locator('article a[href="/api-reference/markdown"]').click();
  await expect(page).toHaveURL(/\/api-reference\/markdown$/);
  await expect(page.getByRole("navigation", { name: "パンくずリスト" })).toContainText(
    "Markdown API",
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/guide\/markdown$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/api-reference\/markdown$/);
  await expect(search).toHaveValue("Markdown");
  expect(await searchNode?.evaluate((node) => node.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});

test("sidebar DOM and latest scroll position survive article, previous-next and history navigation", async ({
  page,
}) => {
  await page.goto("/guide/getting-started");
  await page.waitForLoadState("networkidle");
  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const sidebarNode = await sidebar.elementHandle();
  await sidebar.evaluate((node) => {
    node.scrollTop = 350;
  });
  const offset = await sidebar.evaluate((node) => node.scrollTop);
  expect(offset).toBeGreaterThan(0);
  await page.locator('article a[href="/platforms/node-bun"]').click();
  await expect(page).toHaveURL(/\/platforms\/node-bun$/);
  await expect.poll(() => sidebar.evaluate((node) => node.scrollTop)).toBe(offset);
  expect(await sidebarNode?.evaluate((node) => node.isConnected)).toBe(true);
  await page.getByRole("navigation", { name: "前後のページ" }).getByRole("link").last().click();
  await expect(page).toHaveURL(/\/platforms\/alchemy$/);
  await expect.poll(() => sidebar.evaluate((node) => node.scrollTop)).toBe(offset);
  await sidebar.evaluate((node) => {
    node.scrollTop = 180;
  });
  const latest = await sidebar.evaluate((node) => node.scrollTop);
  await page.goBack();
  await expect(page).toHaveURL(/\/platforms\/node-bun$/);
  await expect.poll(() => sidebar.evaluate((node) => node.scrollTop)).toBe(latest);
  await page.goForward();
  await expect(page).toHaveURL(/\/platforms\/alchemy$/);
  await expect.poll(() => sidebar.evaluate((node) => node.scrollTop)).toBe(latest);
  expect(await sidebarNode?.evaluate((node) => node.isConnected)).toBe(true);
});

test("Markdown headings scroll natively and highlighted code remains selectable and keyboard reachable", async ({
  page,
}) => {
  await page.goto("/platforms/node-bun");
  await page
    .getByRole("complementary", { name: "このページ内" })
    .getByRole("link", { name: "Bun で起動する" })
    .click();
  await expect(page).toHaveURL(/#bun$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const code = page
    .locator("article pre[data-code-block]")
    .filter({ hasText: "import { NodeRuntime }" });
  await expect(code).toHaveAttribute("tabindex", "0");
  await expect(code).toContainText('import { NodeRuntime } from "@effect/platform-node";');
  const token = code.locator('span[style*="--shiki-dark"]').first();
  await expect(token).toBeAttached();
  expect(await token.evaluate((node) => getComputedStyle(node).color)).not.toBe("rgb(0, 0, 0)");
  await code.focus();
  await expect(code).toBeFocused();
});

test("mobile navigation opens a Markdown page without horizontal document overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "ガイドを絞り込む" }).fill("Markdown");
  await dialog.getByRole("link", { name: "Markdown で記事を書く", exact: true }).click();
  await expect(page).toHaveURL(/\/guide\/markdown$/);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("article h1")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  // A full-page screenshot during a native ViewTransition can capture its
  // viewport-sized snapshot instead of the complete destination article.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const finalSection = page.getByRole("heading", { name: "見出し・コード・スタイル", exact: true });
  await finalSection.scrollIntoViewIfNeeded();
  await expect(finalSection).toBeInViewport();
  await page.goto("/guide/markdown#authoring");
  await expect(page).toHaveURL(/#authoring$/);
  await expect(finalSection).toBeInViewport();
  await expect(page.locator("article")).toContainText("完全な Math / Mermaid SSR");
  await page.screenshot({ path: "tmp/docs-mobile-authoring.png" });
  await page.screenshot({ path: "tmp/docs-mobile.png", fullPage: true });
});

test("unknown and historical removed routes return real HTML and Flight 404 responses", async ({
  request,
}) => {
  for (const slug of ["/not-a-document", "/index", "/reading/overview"]) {
    const html = await request.get(slug);
    expect(html.status()).toBe(404);
    const flight = await request.get(slug, { headers: { Accept: "text/x-component" } });
    expect(flight.status()).toBe(404);
  }
});
