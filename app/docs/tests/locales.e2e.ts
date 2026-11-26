import { architectureBaseline } from "#docs/content/architecture-baseline.ts";
import { coreSources } from "#docs/content/core.ts";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Predicate } from "effect";
// oxlint-disable-next-line rules/no-node-imports -- This Node-only Playwright fixture reads the raw Markdown source independently of Vite.
import { readFile } from "node:fs/promises";
import type { LocaleArticle, LocaleDocs } from "./locales.fixture.ts";
import {
  locales,
  localizedSlugs,
  localizedUrl,
  metadata,
  retiredArticles,
} from "./locales.fixture.ts";

const httpStatusOk = 200;
const noMatches = 0;
const adjacentDistance = 1;

const expectArticleHeader = async (
  page: Page,
  docs: LocaleDocs,
  article: LocaleArticle,
): Promise<void> => {
  await expect(page).toHaveTitle(`${article.title} | Effront`);
  await expect(page.locator("html")).toHaveAttribute("lang", docs.locale);
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(page.locator("article")).toHaveAttribute(
    "data-doc-page",
    localizedUrl(docs, article.slug),
  );
  await expect(page.locator("article h1")).toHaveText(article.title);
  await expect(page.locator("article > header > p").last()).toHaveText(article.description);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    article.description,
  );
  await expect(page.locator("article h1")).toHaveCSS("font-size", "36px");
};

const expectNavigation = async (page: Page, docs: LocaleDocs, slug: string): Promise<void> => {
  const navigation = page.getByRole("navigation", { name: docs.labels.navigation });
  const links = navigation.getByRole("link");
  await expect(links).toHaveCount(docs.pages.length);
  expect(
    await links.evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
  ).toEqual(localizedSlugs(docs));
  await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute("href", slug);
};

const expectLocalizedBreadcrumbs = async (
  page: Page,
  docs: LocaleDocs,
  article: LocaleArticle,
): Promise<void> => {
  const breadcrumbs = page.getByRole("navigation", { name: docs.labels.breadcrumbs });
  await expect(breadcrumbs.getByRole("link")).toHaveAttribute("href", `/${docs.locale}`);
  await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(article.title);
};

const expectTableOfContents = async (
  page: Page,
  docs: LocaleDocs,
  article: LocaleArticle,
): Promise<void> => {
  const toc = page.getByRole("complementary", { name: docs.labels.toc });
  await expect(toc.getByRole("link")).toHaveCount(article.headings.length);
  await Promise.all(
    article.headings.map(async ({ id, title }) => {
      await expect(page.locator(`article #${id}`)).toHaveText(title);
      await expect(toc.locator(`a[href="#${id}"]`)).toHaveText(title);
    }),
  );
};

const expectAdjacentPages = async (page: Page, docs: LocaleDocs, index: number): Promise<void> => {
  const previousNext = page.getByRole("navigation", { name: docs.labels.previousNext });
  const hrefs = await previousNext
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(
    localizedSlugs(docs).filter(
      (_slug, candidate) => Math.abs(candidate - index) === adjacentDistance,
    ),
  );
};

const expectLocaleLinks = async (page: Page, docs: LocaleDocs, slug: string): Promise<void> => {
  await Promise.all(
    locales.map(async (destination) =>
      expect(page.locator(`a[hreflang="${destination.locale}"]`)).toHaveAttribute(
        "href",
        localizedUrl(destination, slug),
      ),
    ),
  );
  await expect(page.locator(`a[hreflang="${docs.locale}"]`)).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(
    page.locator('a[href*="production-startup"], a[href$="/guide/testing"]'),
  ).toHaveCount(noMatches);
};

const articleHasCode = async (docs: LocaleDocs, article: LocaleArticle): Promise<boolean> => {
  if ("source" in article) {
    const file = new URL(
      `../src/content/${docs.contentDirectory}${article.source}.md`,
      import.meta.url,
    );
    const markdown = await readFile(file, "utf8");
    return markdown.includes("\n```");
  }
  return true;
};

const expectCodeBlocks = async (page: Page, hasCode: boolean): Promise<void> => {
  const blocks = page.locator("article pre[data-code-block]");
  await (hasCode ? expect(blocks.first()).toBeVisible() : expect(blocks).toHaveCount(noMatches));
  const codeBlocks = await blocks.all();
  await Promise.all(
    codeBlocks.map(async (block) => {
      await expect(block).toHaveAttribute("tabindex", "0");
      await expect(block.locator("code")).not.toHaveText("");
    }),
  );
};

const expectCoreExcerpt = async (excerpt: Locator): Promise<void> => {
  const source = await excerpt.getAttribute("data-core-source");
  expect(
    coreSources.filter((candidate) => candidate.path === source).map((candidate) => candidate.code),
  ).toContain(await excerpt.locator("pre code").textContent());
};

const expectArchitecture = async (page: Page): Promise<void> => {
  const baseline = page.locator("[data-architecture-baseline]");
  await expect(baseline).toHaveAttribute("data-architecture-baseline", architectureBaseline.commit);
  await expect(baseline).toContainText(architectureBaseline.version);
  const excerpts = page.locator("[data-core-source]");
  await expect(excerpts.first()).toBeVisible();
  const authoredExcerpts = await excerpts.all();
  await Promise.all(authoredExcerpts.map(async (excerpt) => expectCoreExcerpt(excerpt)));
};

const expectLinkTarget = (target: URL, docs: LocaleDocs, description: string): void => {
  expect(localizedSlugs(docs), description).toContain(target.pathname);
  if (target.hash.length > noMatches) {
    const article = docs.pages.find(
      (candidate) => localizedUrl(docs, candidate.slug) === target.pathname,
    );
    expect(
      article?.headings.map((heading) => heading.id),
      description,
    ).toContain(decodeURIComponent(target.hash.slice("#".length)));
  }
};

const expectAuthoredLinks = async (page: Page, docs: LocaleDocs, slug: string): Promise<void> => {
  // Each destination also has its own HTTP and heading checks in the matrix.
  const hrefs = await page
    .locator("article a[href]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  const current = new URL(page.url());
  hrefs
    .filter((href) => Predicate.isNotNullish(href))
    .forEach((href) => {
      const target = new URL(href, current);
      if (href.length > noMatches && target.origin === current.origin) {
        expectLinkTarget(target, docs, `${slug} links to ${href}`);
      }
    });
};

const expectLocalizedArticle = async (
  page: Page,
  docs: LocaleDocs,
  { article, index }: Readonly<{ article: LocaleArticle; index: number }>,
): Promise<void> => {
  const slug = localizedUrl(docs, article.slug);
  await expectArticleHeader(page, docs, article);
  await expectNavigation(page, docs, slug);
  await expectLocalizedBreadcrumbs(page, docs, article);
  await expectTableOfContents(page, docs, article);
  await expectAdjacentPages(page, docs, index);
  await expectLocaleLinks(page, docs, article.slug);
};

const registerArticleChecks = (docs: LocaleDocs): void => {
  docs.pages.forEach((article, index) => {
    const slug = localizedUrl(docs, article.slug);
    test(`${slug} serves localized content, TOC, code and article links`, async ({ page }) => {
      const response = await page.goto(slug);
      expect(response?.status()).toBe(httpStatusOk);
      await expectLocalizedArticle(page, docs, { article, index });
      const hasCode = await articleHasCode(docs, article);
      await expectCodeBlocks(page, hasCode);
      if (article.slug.startsWith("/architecture/")) {
        await expectArchitecture(page);
      }
      await expectAuthoredLinks(page, docs, slug);
    });
  });
};

const registerCanonicalUrls = (docs: LocaleDocs): void => {
  ["/", "/guide/routes"].forEach((path) => {
    const canonical = localizedUrl(docs, path);
    test(`${canonical}/ serves its canonical article and localized navigation`, async ({
      page,
    }) => {
      const response = await page.goto(`${canonical}/`);
      expect(response?.status()).toBe(httpStatusOk);
      expect(response?.headers()["content-type"]).toContain("text/html");
      await expect(page.locator("html")).toHaveAttribute("lang", docs.locale);
      await expect(page.locator("article")).toHaveAttribute("data-doc-page", canonical);
      await expect(page.locator("article h1")).toHaveText(metadata(docs, path).title);
      await expectNavigation(page, docs, canonical);
    });
  });
};

const registerRetiredBookmarks = (docs: LocaleDocs): void => {
  retiredArticles.forEach(({ canonical, fragment, retired }) => {
    test(`${localizedUrl(docs, retired)} keeps a bookmarked query and anchor`, async ({ page }) => {
      const response = await page.goto(`${localizedUrl(docs, retired)}?from=bookmark${fragment}`);
      expect(response?.status()).toBe(httpStatusOk);
      await expect(page).toHaveURL(`${localizedUrl(docs, canonical)}?from=bookmark${fragment}`);
      await expect(page.locator("html")).toHaveAttribute("lang", docs.locale);
      await expect(page.locator("article")).toHaveAttribute(
        "data-doc-page",
        localizedUrl(docs, canonical),
      );
      if (fragment.length > noMatches) {
        await expect(page.locator(`article ${fragment}`)).toBeInViewport();
      }
    });
  });
};

locales.forEach((docs) => {
  test.describe(`${docs.locale} documentation without JavaScript`, () => {
    test.use({ javaScriptEnabled: false });
    registerArticleChecks(docs);
    registerCanonicalUrls(docs);
    registerRetiredBookmarks(docs);
  });
});
