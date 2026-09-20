import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { architectureBaseline } from "../src/content/architecture-baseline";
import { articleCatalog } from "../src/content/catalog";
import { corePages, coreSources } from "../src/content/core";
import { englishArticleCatalog } from "../src/content/en/catalog";
import { englishCorePages } from "../src/content/en/core";

// Import metadata directly: content/index also loads the Vite-only Markdown glob.
// Expectations deliberately construct public URLs without the production locale helpers.
const locales = [
  {
    locale: "en",
    articles: englishArticleCatalog,
    core: englishCorePages,
    contentDirectory: "en/articles",
    labels: {
      navigation: "Documentation navigation",
      search: "Filter guides",
      breadcrumbs: "Breadcrumbs",
      previousNext: "Previous and next pages",
      toc: "On this page",
      language: "Language",
      empty: "No guides match your search.",
    },
  },
  {
    locale: "ja",
    articles: articleCatalog,
    core: corePages,
    contentDirectory: "articles",
    labels: {
      navigation: "ドキュメントナビゲーション",
      search: "ガイドを絞り込む",
      breadcrumbs: "パンくずリスト",
      previousNext: "前後のページ",
      toc: "このページ内",
      language: "言語",
      empty: "一致するガイドはありません。",
    },
  },
] as const;

const retiredArticles = [
  { retired: "/advanced/production-startup", canonical: "/platforms", fragment: "" },
  { retired: "/guide/testing", canonical: "/best-practices/testing", fragment: "#production" },
];

for (const { locale, articles, core, contentDirectory, labels } of locales) {
  const localizedUrl = (slug: string) => `/${locale}${slug === "/" ? "" : slug}`;
  const pages = [
    ...articles.map((article) => ({
      ...article,
      hasCode: readFileSync(
        new URL(`../src/content/${contentDirectory}${article.source}.md`, import.meta.url),
        "utf8",
      ).includes("\n```"),
    })),
    ...core.map((article) => ({ ...article, hasCode: true })),
  ];
  const slugs = pages.map((article) => localizedUrl(article.slug));
  const metadata = (slug: string) => {
    const article = pages.find((candidate) => candidate.slug === slug);
    if (!article) throw new Error(`Missing ${locale} browser-test article metadata: ${slug}`);
    return article;
  };

  test.describe(`${locale} documentation without JavaScript`, () => {
    test.use({ javaScriptEnabled: false });

    for (const [index, article] of pages.entries()) {
      const slug = localizedUrl(article.slug);
      test(`${slug} serves localized content, TOC, code and article links`, async ({ page }) => {
        const response = await page.goto(slug);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle(`${article.title} | Effront`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveClass("dark");
        await expect(page.locator("article")).toHaveAttribute("data-doc-page", slug);
        await expect(page.locator("article h1")).toHaveText(article.title);
        await expect(page.locator("article > header > p").last()).toHaveText(article.description);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          article.description,
        );
        await expect(page.locator("article h1")).toHaveCSS("font-size", "36px");

        const navigation = page.getByRole("navigation", { name: labels.navigation });
        await expect(navigation.getByRole("link")).toHaveCount(38);
        expect(
          await navigation
            .getByRole("link")
            .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
        ).toEqual(slugs);
        await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute("href", slug);
        const breadcrumbs = page.getByRole("navigation", { name: labels.breadcrumbs });
        await expect(breadcrumbs.getByRole("link")).toHaveAttribute("href", `/${locale}`);
        await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(article.title);

        const toc = page.getByRole("complementary", { name: labels.toc });
        await expect(toc.getByRole("link")).toHaveCount(article.headings.length);
        for (const heading of article.headings) {
          await expect(page.locator(`article #${heading.id}`)).toHaveText(heading.title);
          await expect(toc.locator(`a[href="#${heading.id}"]`)).toHaveText(heading.title);
        }
        const previousNext = page.getByRole("navigation", { name: labels.previousNext });
        expect(
          await previousNext
            .getByRole("link")
            .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
        ).toEqual(
          slugs.filter((_, candidate) => candidate === index - 1 || candidate === index + 1),
        );
        for (const language of ["en", "ja"]) {
          await expect(page.locator(`a[hreflang="${language}"]`)).toHaveAttribute(
            "href",
            `/${language}${article.slug === "/" ? "" : article.slug}`,
          );
        }
        await expect(page.locator(`a[hreflang="${locale}"]`)).toHaveAttribute(
          "aria-current",
          "true",
        );
        await expect(
          page.locator('a[href*="production-startup"], a[href$="/guide/testing"]'),
        ).toHaveCount(0);

        const codeBlocks = page.locator("article pre[data-code-block]");
        if (article.hasCode) {
          await expect(codeBlocks.first()).toBeVisible();
        } else {
          await expect(codeBlocks).toHaveCount(0);
        }
        for (const block of await codeBlocks.all()) {
          await expect(block).toHaveAttribute("tabindex", "0");
          await expect(block.locator("code")).not.toHaveText("");
        }
        if (article.slug.startsWith("/architecture/")) {
          await expect(page.locator("[data-architecture-baseline]")).toHaveAttribute(
            "data-architecture-baseline",
            architectureBaseline.commit,
          );
          await expect(page.locator("[data-architecture-baseline]")).toContainText(
            architectureBaseline.version,
          );
          const excerpts = page.locator("[data-core-source]");
          await expect(excerpts.first()).toBeVisible();
          for (const excerpt of await excerpts.all()) {
            const source = await excerpt.getAttribute("data-core-source");
            expect(
              coreSources
                .filter((candidate) => candidate.path === source)
                .map((candidate) => candidate.code),
            ).toContain(await excerpt.locator("pre code").textContent());
          }
        }

        // All targets also have their own real HTTP/heading test in this matrix.
        const hrefs = await page
          .locator("article a[href]")
          .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
        for (const href of hrefs) {
          if (!href) continue;
          const target = new URL(href, page.url());
          if (target.origin !== new URL(page.url()).origin) continue;
          expect(slugs, `${slug} links to ${href}`).toContain(target.pathname);
          if (target.hash) {
            const targetArticle = pages.find(
              (candidate) => localizedUrl(candidate.slug) === target.pathname,
            );
            expect(
              targetArticle?.headings.map((heading) => heading.id),
              `${slug} links to ${href}`,
            ).toContain(decodeURIComponent(target.hash.slice(1)));
          }
        }
      });
    }

    for (const path of ["/", "/guide/routes"]) {
      const canonical = localizedUrl(path);
      test(`${canonical}/ serves its canonical article and localized navigation`, async ({
        page,
      }) => {
        const response = await page.goto(`${canonical}/`);
        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toContain("text/html");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("article")).toHaveAttribute("data-doc-page", canonical);
        await expect(page.locator("article h1")).toHaveText(metadata(path).title);
        const navigation = page.getByRole("navigation", { name: labels.navigation });
        await expect(navigation.getByRole("link")).toHaveCount(38);
        expect(
          await navigation
            .getByRole("link")
            .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
        ).toEqual(slugs);
        await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute(
          "href",
          canonical,
        );
      });
    }

    for (const { retired, canonical, fragment } of retiredArticles) {
      test(`${localizedUrl(retired)} keeps a bookmarked query and anchor`, async ({ page }) => {
        const response = await page.goto(`${localizedUrl(retired)}?from=bookmark${fragment}`);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(`${localizedUrl(canonical)}?from=bookmark${fragment}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("article")).toHaveAttribute(
          "data-doc-page",
          localizedUrl(canonical),
        );
        if (fragment) await expect(page.locator(`article ${fragment}`)).toBeInViewport();
      });
    }
  });

  test(`${locale} search, sidebar, article links and previous-next navigation retain the locale and shell`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${locale}`);
    await page.waitForLoadState("networkidle");
    const search = page.getByRole("textbox", { name: labels.search });
    const searchNode = await search.elementHandle();
    const sidebar = page.locator('[data-slot="sidebar-content"]');
    await search.fill("not-a-guide-9284");
    await expect(sidebar.getByRole("link")).toHaveCount(0);
    await expect(sidebar).toContainText(labels.empty);
    await search.fill("Markdown");
    await expect(sidebar.getByRole("link")).toHaveCount(2);
    expect(
      await sidebar
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual([localizedUrl("/guide/markdown"), localizedUrl("/api-reference/markdown")]);
    await sidebar.locator(`a[href="${localizedUrl("/guide/markdown")}"]`).click();
    await expect(page).toHaveURL(localizedUrl("/guide/markdown"));
    await expect(page.locator("article h1")).toHaveText(metadata("/guide/markdown").title);
    await page
      .locator(`article a[href="${localizedUrl("/api-reference/markdown")}#parse"]`)
      .click();
    await expect(page).toHaveURL(`${localizedUrl("/api-reference/markdown")}#parse`);
    await expect(page.locator("article #parse")).toBeInViewport();
    const index = pages.findIndex((article) => article.slug === "/api-reference/markdown");
    const nextSlug = slugs[index + 1];
    if (!nextSlug) throw new Error(`Missing ${locale} next-page metadata`);
    const adjacent = page.getByRole("navigation", { name: labels.previousNext });
    await adjacent.getByRole("link").last().click();
    await expect(page).toHaveURL(nextSlug);
    await adjacent.getByRole("link").first().click();
    await expect(page).toHaveURL(localizedUrl("/api-reference/markdown"));
    await page.goBack();
    await expect(page).toHaveURL(nextSlug);
    await page.goForward();
    await expect(page).toHaveURL(localizedUrl("/api-reference/markdown"));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(search).toHaveValue("Markdown");
    expect(await searchNode?.evaluate((node) => node.isConnected)).toBe(true);
    expect(errors).toEqual([]);
  });

  for (const slug of ["/guide/markdown", "/architecture/implementation/overview"]) {
    test(`${locale}${slug} switches language without changing the article`, async ({ page }) => {
      const other = locale === "en" ? "ja" : "en";
      const destination = `/${other}${slug}`;
      await page.goto(localizedUrl(slug));
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("navigation", { name: labels.language })
        .locator(`a[hreflang="${other}"]`)
        .click();
      await expect(page).toHaveURL(destination);
      await expect(page.locator("article")).toHaveAttribute("data-doc-page", destination);
      await expect(page.locator("html")).toHaveAttribute("lang", other);
      await expect(
        page.getByRole("textbox", { name: other === "en" ? "Filter guides" : "ガイドを絞り込む" }),
      ).toBeVisible();
      await expect(page.locator(`a[hreflang="${other}"]`)).toHaveAttribute("aria-current", "true");
      const otherPages =
        other === "en"
          ? [...englishArticleCatalog, ...englishCorePages]
          : [...articleCatalog, ...corePages];
      const destinationArticle = otherPages.find((article) => article.slug === slug);
      if (!destinationArticle) throw new Error(`Missing translated article: ${destination}`);
      await expect(page.locator("article h1")).toHaveText(destinationArticle.title);
      const sidebarLinks = page.locator('[data-slot="sidebar-content"]').getByRole("link");
      await expect(sidebarLinks).toHaveCount(38);
      expect(
        await sidebarLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
      ).toEqual(
        otherPages.map((article) => `/${other}${article.slug === "/" ? "" : article.slug}`),
      );
      await expect(
        page
          .getByRole("complementary", { name: other === "en" ? "On this page" : "このページ内" })
          .getByRole("link"),
      ).toHaveText(destinationArticle.headings.map((heading) => heading.title));
      await page.locator(`a[hreflang="${locale}"]`).click();
      await expect(page).toHaveURL(localizedUrl(slug));
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("article h1")).toHaveText(metadata(slug).title);
    });
  }

  test(`${locale} mobile navigation and long code fit a 390px viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}`);
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: labels.search }).fill("Markdown");
    await dialog.locator(`a[href="${localizedUrl("/guide/markdown")}"]`).click();
    await expect(page).toHaveURL(localizedUrl("/guide/markdown"));
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("article h1")).toHaveText(metadata("/guide/markdown").title);
    await expect(page.getByRole("navigation", { name: labels.language })).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await page.goto(`${localizedUrl("/guide/markdown")}#authoring`);
    await expect(page.locator("article #authoring")).toBeInViewport();
    const code = page
      .locator("article pre[data-code-block]")
      .filter({ hasText: "plugins: [toc()]" });
    await expect(code).toHaveAttribute("tabindex", "0");
    await code.focus();
    await expect(code).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
  });

  for (const { retired, canonical } of retiredArticles) {
    for (const accept of ["text/html", "text/x-component"]) {
      for (const method of ["GET", "HEAD"]) {
        test(`${localizedUrl(retired)} redirects ${method} ${accept} within its locale`, async ({
          request,
        }) => {
          const bookmark = `${localizedUrl(retired)}?from=bookmark`;
          const response = await request.fetch(bookmark, {
            method,
            headers: { Accept: accept },
            maxRedirects: 0,
          });
          expect(response.status()).toBe(308);
          expect(response.headers()["location"]).toBe(`${localizedUrl(canonical)}?from=bookmark`);
          expect(await response.body()).toHaveLength(0);
          const followed = await request.fetch(bookmark, { method, headers: { Accept: accept } });
          expect(followed.status()).toBe(200);
          expect(new URL(followed.url()).pathname).toBe(localizedUrl(canonical));
          expect(new URL(followed.url()).search).toBe("?from=bookmark");
          expect(followed.headers()["content-type"]).toContain(accept);
          if (method === "HEAD") {
            expect(await followed.body()).toHaveLength(0);
          } else {
            expect(await followed.text()).toContain(metadata(canonical).title);
          }
        });
      }
    }
  }

  for (const path of [
    "/not-a-document",
    "/index",
    "/reading/overview",
    "/advanced/production-startup-extra",
    "/guide/testing-extra",
  ]) {
    for (const accept of ["text/html", "text/x-component"]) {
      test(`${localizedUrl(path)} returns a real ${accept} 404`, async ({ request }) => {
        const response = await request.get(localizedUrl(path), {
          headers: { Accept: accept },
          maxRedirects: 0,
        });
        expect(response.status()).toBe(404);
      });
    }
  }
}
