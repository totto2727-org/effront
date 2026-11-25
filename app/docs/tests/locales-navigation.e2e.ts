import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Data, Predicate } from "effect";
import type { LocaleDocs } from "./locales.fixture.ts";
import { locales, localizedSlugs, localizedUrl, metadata, otherLocale } from "./locales.fixture.ts";

const noMatches = 0;
const markdownMatches = 2;
const nextPage = 1;
const markdownGuide = "/guide/markdown";
const markdownReference = "/api-reference/markdown";
const sidebarSelector = '[data-slot="sidebar-content"]';
const mobileViewport = { height: 844, width: 390 };

class MissingNextPage extends Data.TaggedError("MissingNextPage")<{ locale: string }> {}

const expectMarkdownSearch = async (
  page: Page,
  docs: LocaleDocs,
  search: Locator,
): Promise<void> => {
  const sidebar = page.locator(sidebarSelector);
  await search.fill("not-a-guide-9284");
  await expect(sidebar.getByRole("link")).toHaveCount(noMatches);
  await expect(sidebar).toContainText(docs.labels.empty);
  await search.fill("Markdown");
  const links = sidebar.getByRole("link");
  await expect(links).toHaveCount(markdownMatches);
  const hrefs = await links.evaluateAll((items) => items.map((item) => item.getAttribute("href")));
  expect(hrefs).toEqual([localizedUrl(docs, markdownGuide), localizedUrl(docs, markdownReference)]);
};

const followMarkdownLinks = async (page: Page, docs: LocaleDocs): Promise<void> => {
  const guide = localizedUrl(docs, markdownGuide);
  const reference = localizedUrl(docs, markdownReference);
  await page.locator(sidebarSelector).locator(`a[href="${guide}"]`).click();
  await expect(page).toHaveURL(guide);
  await expect(page.locator("article h1")).toHaveText(metadata(docs, markdownGuide).title);
  await page.locator(`article a[href="${reference}#parse"]`).click();
  await expect(page).toHaveURL(`${reference}#parse`);
  await expect(page.locator("article #parse")).toBeInViewport();
};

const nextMarkdownPage = (docs: LocaleDocs): string => {
  const index = docs.pages.findIndex((article) => article.slug === markdownReference);
  const next = localizedSlugs(docs).at(index + nextPage);
  if (Predicate.isNullish(next)) {
    throw new MissingNextPage({ locale: docs.locale });
  }
  return next;
};

const revisitReference = async (
  page: Page,
  { next, reference }: Readonly<{ next: string; reference: string }>,
): Promise<void> => {
  await page.goBack();
  await expect(page).toHaveURL(next);
  await page.goForward();
  await expect(page).toHaveURL(reference);
};

const followAdjacentPages = async (page: Page, docs: LocaleDocs): Promise<void> => {
  const next = nextMarkdownPage(docs);
  const adjacent = page
    .getByRole("navigation", { name: docs.labels.previousNext })
    .getByRole("link");
  await adjacent.last().click();
  await expect(page).toHaveURL(next);
  await adjacent.first().click();
  const reference = localizedUrl(docs, markdownReference);
  await expect(page).toHaveURL(reference);
  await revisitReference(page, { next, reference });
};

const openFilteredDocs = async (page: Page, docs: LocaleDocs): Promise<Locator> => {
  await page.goto(localizedUrl(docs, "/"));
  await page.waitForLoadState("networkidle");
  return page.getByRole("textbox", { name: docs.labels.search });
};

const expectSearchState = async (page: Page, docs: LocaleDocs, search: Locator): Promise<void> => {
  await expect(page.locator("html")).toHaveAttribute("lang", docs.locale);
  await expect(search).toHaveValue("Markdown");
};

const registerSearchCheck = (docs: LocaleDocs): void => {
  test(`${docs.locale} search, sidebar, article links and previous-next navigation retain the locale and shell`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const search = await openFilteredDocs(page, docs);
    const searchNode = await search.elementHandle();
    await expectMarkdownSearch(page, docs, search);
    await followMarkdownLinks(page, docs);
    await followAdjacentPages(page, docs);
    await expectSearchState(page, docs, search);
    const connected = await searchNode.evaluate((node) => node.isConnected);
    expect({ connected, errors }).toEqual({ connected: true, errors: [] });
  });
};

const expectTranslatedShell = async (page: Page, docs: LocaleDocs, slug: string): Promise<void> => {
  const destination = localizedUrl(docs, slug);
  await expect(page).toHaveURL(destination);
  await expect(page.locator("article")).toHaveAttribute("data-doc-page", destination);
  await expect(page.locator("html")).toHaveAttribute("lang", docs.locale);
  await expect(page.getByRole("textbox", { name: docs.labels.search })).toBeVisible();
  await expect(page.locator(`a[hreflang="${docs.locale}"]`)).toHaveAttribute(
    "aria-current",
    "true",
  );
};

const expectTranslatedArticle = async (
  page: Page,
  docs: LocaleDocs,
  slug: string,
): Promise<void> => {
  const article = metadata(docs, slug);
  await expect(page.locator("article h1")).toHaveText(article.title);
  const links = page.locator(sidebarSelector).getByRole("link");
  await expect(links).toHaveCount(docs.pages.length);
  const hrefs = await links.evaluateAll((items) => items.map((item) => item.getAttribute("href")));
  expect(hrefs).toEqual(localizedSlugs(docs));
  const toc = page.getByRole("complementary", { name: docs.labels.toc }).getByRole("link");
  await expect(toc).toHaveText(article.headings.map((heading) => heading.title));
};

const switchArticleLocale = async (
  page: Page,
  docs: LocaleDocs,
  { destination, slug }: Readonly<{ destination: LocaleDocs; slug: string }>,
): Promise<void> => {
  await page.goto(localizedUrl(docs, slug));
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("navigation", { name: docs.labels.language })
    .locator(`a[hreflang="${destination.locale}"]`)
    .click();
};

const registerLanguageSwitches = (docs: LocaleDocs): void => {
  [markdownGuide, "/architecture/implementation/overview"].forEach((slug) => {
    test(`${docs.locale}${slug} switches language without changing the article`, async ({
      page,
    }) => {
      const destination = otherLocale(docs);
      await switchArticleLocale(page, docs, { destination, slug });
      await expectTranslatedShell(page, destination, slug);
      await expectTranslatedArticle(page, destination, slug);
      await page.locator(`a[hreflang="${docs.locale}"]`).click();
      await expect(page).toHaveURL(localizedUrl(docs, slug));
      await expect(page.locator("html")).toHaveAttribute("lang", docs.locale);
      await expect(page.locator("article h1")).toHaveText(metadata(docs, slug).title);
    });
  });
};

const expectMobileViewport = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(mobileViewport.width);
};

const openMobileArticle = async (page: Page, docs: LocaleDocs): Promise<void> => {
  await page.setViewportSize(mobileViewport);
  await page.goto(localizedUrl(docs, "/"));
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: docs.labels.search }).fill("Markdown");
  const guide = localizedUrl(docs, markdownGuide);
  await dialog.locator(`a[href="${guide}"]`).click();
  await expect(page).toHaveURL(guide);
  await expect(dialog).not.toBeVisible();
};

const expectCodeFocus = async (page: Page): Promise<void> => {
  const code = page.locator("article pre[data-code-block]").filter({ hasText: "plugins: [toc()]" });
  await expect(code).toHaveAttribute("tabindex", "0");
  await code.focus();
  await expect(code).toBeFocused();
};

const registerMobileCheck = (docs: LocaleDocs): void => {
  test(`${docs.locale} mobile navigation and long code fit a 390px viewport`, async ({ page }) => {
    await openMobileArticle(page, docs);
    await expect(page.locator("article h1")).toHaveText(metadata(docs, markdownGuide).title);
    await expect(page.getByRole("navigation", { name: docs.labels.language })).toBeInViewport();
    await expectMobileViewport(page);
    await page.goto(`${localizedUrl(docs, markdownGuide)}#authoring`);
    await expect(page.locator("article #authoring")).toBeInViewport();
    await expectCodeFocus(page);
    await expectMobileViewport(page);
  });
};

locales.forEach((docs) => {
  registerSearchCheck(docs);
  registerLanguageSwitches(docs);
  registerMobileCheck(docs);
});
