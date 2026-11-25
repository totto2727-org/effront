import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { Array, Data, Predicate, String } from "effect";

const roundingTolerance = 1;
const firstHeadingLevel = 1;
const anchorPrefixLength = 1;
const singleAnchor = 1;
const emptyCount = 0;

type ManualRoute = Readonly<{ path: string; title: string }>;

class DocumentationLinkMissing extends Data.TaggedError("DocumentationLinkMissing")<{
  message: string;
}> {}

// Content completeness belongs to app/docs. These routes exercise the persistent shell on a built host.
export const manualRoutes: Readonly<ManualRoute[]> = [
  { path: "/manual", title: "Markdown manual" },
  { path: "/manual/guide/getting-started", title: "Getting started" },
  { path: "/manual/guide/deep/details", title: "Deep details" },
  { path: `/manual/guide/${encodeURIComponent("日本語 space")}`, title: "Unicode page" },
];

export const manualArticle = (page: Page): Locator => page.locator("main article");

export const visibleSidebar = (page: Page): Locator =>
  page.locator('[data-sidebar="sidebar"]:visible');

export const articleHeadingLinks = (page: Page): Locator =>
  page.getByRole("complementary", { name: "このページ内" }).locator('a[href^="#"]');

export const requireHref = async (link: Locator, message: string): Promise<string> => {
  const href = await link.getAttribute("href");
  if (Predicate.isNullish(href) || String.isEmpty(href)) {
    throw new DocumentationLinkMissing({ message });
  }
  return href;
};

export const headingSelector = (href: string): string => {
  const id = decodeURIComponent(href.slice(anchorPrefixLength));
  return `[id=${JSON.stringify(id)}]`;
};

export const expectHeadingAnchors = async (page: Page): Promise<void> => {
  const headingLinks = await articleHeadingLinks(page).all();
  expect(headingLinks.length).toBeGreaterThan(emptyCount);
  const article = manualArticle(page);
  await Promise.all(
    headingLinks.map(async (link) => {
      const href = await requireHref(link, "Expected a heading anchor");
      await expect(article.locator(headingSelector(href))).toHaveCount(singleAnchor);
    }),
  );
};

export const expectArticleTitle = async (article: Locator, title: string): Promise<void> => {
  await expect(article.getByRole("heading", { level: firstHeadingLevel })).toHaveText(title);
};

export const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  const rightEdge = dimensions.viewport + roundingTolerance;
  expect(dimensions.document, "The document must fit the viewport").toBeLessThanOrEqual(rightEdge);
  expect(dimensions.body, "The body must fit the viewport").toBeLessThanOrEqual(rightEdge);
};

const readLabels = async (
  scope: Locator,
): Promise<
  Readonly<
    {
      bottom: number;
      clipped: boolean;
      title: string;
      top: number;
    }[]
  >
> =>
  scope.locator('a[data-sidebar="menu-button"]').evaluateAll(
    (nodes, tolerance) =>
      nodes.map((anchor) => {
        const bounds = anchor.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(anchor);
        const clipped = [...range.getClientRects()].some(
          (rect) =>
            rect.top < bounds.top - tolerance ||
            rect.bottom > bounds.bottom + tolerance ||
            rect.left < bounds.left - tolerance ||
            rect.right > bounds.right + tolerance,
        );
        return {
          bottom: bounds.bottom,
          clipped: clipped || anchor.scrollHeight > anchor.clientHeight + tolerance,
          title: anchor.textContent,
          top: bounds.top,
        };
      }),
    roundingTolerance,
  );

export const expectUnclippedSidebarLabels = async (scope: Locator): Promise<void> => {
  const labels = await readLabels(scope);
  expect(labels.length).toBeGreaterThan(emptyCount);
  labels.forEach((label) => {
    expect(label.clipped, `Sidebar label must fit its own link: ${label.title}`).toBe(false);
  });
  Array.zip(labels, labels.slice(singleAnchor)).forEach(([previous, current]) => {
    expect(current.top, `Sidebar links must not overlap: ${current.title}`).toBeGreaterThanOrEqual(
      previous.bottom - roundingTolerance,
    );
  });
};
