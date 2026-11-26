import { architectureBaseline } from "#docs/content/architecture-baseline.ts";
import { coreSources } from "#docs/content/core.ts";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { articleMetadata, pages } from "./docs-catalog.fixture.ts";

const httpStatusOk = 200;
const noMatches = 0;
const headingIds = ["setup", "stylesheet", "scope"];

const expectAuthoredExcerpt = async (excerpt: Locator): Promise<void> => {
  const path = await excerpt.getAttribute("data-core-source");
  const selections = coreSources.filter((candidate) => candidate.path === path);
  expect(selections.length).toBeGreaterThan(noMatches);
  // A source file can have multiple authored selections. Compare the exact rendered text.
  expect(selections.map((source) => source.code)).toContain(
    await excerpt.locator("pre code").textContent(),
  );
};

const expectArchitectureBaseline = async (page: Page): Promise<void> => {
  const baseline = page.locator("[data-architecture-baseline]");
  await expect(baseline).toHaveAttribute("data-architecture-baseline", architectureBaseline.commit);
  await expect(baseline).toContainText(architectureBaseline.version);
  const excerpts = await page.locator("[data-core-source]").all();
  await Promise.all(excerpts.map(async (excerpt) => expectAuthoredExcerpt(excerpt)));
};

const expectDocumentShell = async (page: Page, article: (typeof pages)[number]): Promise<void> => {
  await expect(page).toHaveTitle(`${article.title} | Effront`);
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator("article h1")).toHaveText(article.title);
  await expect(page.locator("article")).toHaveAttribute("data-doc-page", article.slug);
  await expect(
    page.getByRole("navigation", { name: "ドキュメントナビゲーション" }).getByRole("link"),
  ).toHaveCount(pages.length);
  await expect(page.locator('a[href*="production-startup"]')).toHaveCount(noMatches);
};

test.describe("built documentation without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  pages.forEach((article) => {
    test(`${article.slug} serves its article, navigation, anchors and styles`, async ({ page }) => {
      const response = await page.goto(article.slug);
      expect(response?.status()).toBe(httpStatusOk);
      await expectDocumentShell(page, article);
      await Promise.all(
        article.headings.map(async ({ id, title }) =>
          expect(page.locator(`article #${id}`)).toHaveText(title),
        ),
      );
      await expect(page.locator("article h1")).toHaveCSS("font-size", "36px");
      if (article.section === "アーキテクチャ") {
        await expectArchitectureBaseline(page);
      }
    });
  });
});

const expectDefaultStyling = async (article: Locator): Promise<void> => {
  await expect(article.locator("h2")).toHaveText(
    articleMetadata("/guide/styling").headings.map((heading) => heading.title),
  );
  await expect(article.locator("h2")).toHaveCount(headingIds.length);
  await Promise.all(
    headingIds.map(async (id) => expect(article.locator(`h2#${id}`)).toBeVisible()),
  );
  await expect(article).toContainText(/スタイルシート[^。]*CSS import[^。]*不要/u);
  const defaults = article.locator("pre code").filter({
    hasText: "plugins: [effront(), effrontServer(), effrontTailwind()]",
  });
  await expect(defaults).toContainText("plugins: [effront(), effrontServer(), effrontTailwind()]");
  await expect(article).not.toContainText("stylingPlugins");
  await expect(defaults).not.toContainText("stylesheet:");
};

const expectOptionalStyling = async (article: Locator): Promise<void> => {
  await expect(article.locator("pre code").filter({ hasText: "--color-brand" })).toBeVisible();
  await expect(article.locator("h2#scope")).toHaveText(/必要に応じて/u);
  await expect(
    article.locator("pre code").filter({ hasText: '@plugin "@tailwindcss/typography"' }),
  ).toBeVisible();
  await expect(article).toContainText(/Typography は[^。]*Markdown[^。]*必須ではありません/u);
};

test("styling distinguishes default setup from optional theme and plugin configuration", async ({
  page,
}) => {
  await page.goto("/guide/styling");
  const article = page.locator("article");
  await expectDefaultStyling(article);
  await expectOptionalStyling(article);
  await article.getByRole("link", { exact: true, name: "Tailwind API" }).click();
  await expect(page).toHaveURL(/\/api-reference\/tailwind$/u);
  await expect(page.locator("article h2#stylesheet")).toHaveText("stylesheet");
  await expect(
    page.locator("article").getByRole("row").filter({ hasText: "undefined" }),
  ).toContainText(/既定[^。]*生成/u);
  await expect(page.locator("article")).toContainText(/CSS ファイル[^。]*不要/u);
});

const expectMarkdownExtensionContract = async (page: Page): Promise<void> => {
  const reference = page.locator("article");
  await expect(reference.locator("p").filter({ hasText: "options.plugins" })).toContainText(
    /後に追加[^。]*置き換えにはなりません/u,
  );
  await expect(reference).toContainText(/プラグインを削除[^。]*オプションはありません/u);
  await expect(
    reference.locator('[data-alert="warning"]').filter({ hasText: "sanitizer" }),
  ).toContainText(/sanitizer ではありません/u);
  await expect(page.locator('article a[href="https://comark.dev"]')).toBeVisible();
};

test("Markdown readers can reach the default configuration and find the extension contract", async ({
  page,
}) => {
  await page.goto("/guide/markdown#authoring");
  const article = page.locator("article");
  await expect(article.locator("#authoring")).toBeInViewport();
  await expect(article.locator("code").filter({ hasText: "linkify: false" })).toBeVisible();
  await expect(article.locator("pre code").filter({ hasText: "plugins: [toc()]" })).toBeVisible();
  await article.locator('a[href="/api-reference/markdown#parse"]').click();
  await expect(page).toHaveURL(/\/api-reference\/markdown#parse$/u);
  await expect(page.locator("article #parse")).toBeInViewport();
  await expectMarkdownExtensionContract(page);
});
