import { expect } from "@playwright/test";
import type { JSHandle, Locator, Page } from "@playwright/test";

import {
  expectArticleTitle,
  expectHeadingAnchors,
  manualArticle,
  manualRoutes,
  visibleSidebar,
} from "./layout-assertions.browser.fixture.ts";

const midpointDivisor = 2;
const minimumScrollChange = 20;
const minimumLinkInset = 2;
const sidebarClickInset = 16;
const scrollTolerance = 1;
const singleLink = 1;
const originalFilter = " ";

interface SidebarSnapshot {
  filter: HTMLInputElement;
  scrollTop: number;
  scroller: HTMLElement;
  sidebar: Element;
}

type SidebarRetention = Readonly<{
  filter: Locator;
  retained: JSHandle<SidebarSnapshot>;
  sidebar: Locator;
}>;

const snapshotSidebar = async (page: Page): Promise<JSHandle<SidebarSnapshot>> =>
  page.evaluateHandle((divisor) => {
    const sidebar = document.querySelector('[data-sidebar="sidebar"]');
    const scroller = sidebar?.querySelector<HTMLElement>('[data-sidebar="content"]');
    const filter = sidebar?.querySelector("input");
    if (!sidebar || !scroller || !filter) {
      throw new DOMException("Expected rendered sidebar controls", "InvalidStateError");
    }
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / divisor;
    return { filter, scrollTop: scroller.scrollTop, scroller, sidebar };
  }, midpointDivisor);

export const startSidebarRetention = async (page: Page): Promise<SidebarRetention> => {
  const sidebar = visibleSidebar(page);
  const filter = sidebar.getByRole("textbox", { name: "ガイドを絞り込む" });
  await filter.fill(originalFilter);
  await expect(sidebar.locator('a[data-sidebar="menu-button"]')).toHaveCount(manualRoutes.length);
  const retained = await snapshotSidebar(page);
  const startScroll = await retained.evaluate((before) => before.scrollTop);
  expect(startScroll).toBeGreaterThan(minimumScrollChange);
  return { filter, retained, sidebar };
};

export const expectRetainedSidebar = async ({
  filter,
  retained,
}: SidebarRetention): Promise<void> => {
  const state = await retained.evaluate((before) => {
    const sidebar = document.querySelector('[data-sidebar="sidebar"]');
    const scroller = sidebar?.querySelector<HTMLElement>('[data-sidebar="content"]');
    return {
      inputIdentity: sidebar?.querySelector("input") === before.filter,
      scrollDelta: Math.abs((scroller?.scrollTop ?? Number.MIN_SAFE_INTEGER) - before.scrollTop),
      scrollerIdentity: scroller === before.scroller,
      sidebarIdentity: sidebar === before.sidebar,
    };
  });
  expect(state.sidebarIdentity, "The sidebar itself must not remount").toBe(true);
  expect(state.scrollerIdentity, "The actual overflow container must not remount").toBe(true);
  expect(state.inputIdentity, "The filter input must stay mounted").toBe(true);
  expect(
    state.scrollDelta,
    "Navigation must not reset or reposition sidebar scrollTop",
  ).toBeLessThanOrEqual(scrollTolerance);
  await expect(filter).toHaveValue(originalFilter);
};

const activeSidebarLink = async (sidebar: Locator, path: string): Promise<Locator> => {
  const link = sidebar.locator('a[aria-current="page"]');
  await expect(link).toHaveCount(singleLink);
  await expect(link).toHaveAttribute("href", path);
  return link;
};

const expectActiveArticle = async (page: Page, sidebar: Locator, path: string): Promise<void> => {
  const article = manualArticle(page);
  await expect(article).toHaveAttribute("data-doc-page", path);
  const currentLink = await activeSidebarLink(sidebar, path);
  // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Compare the painted title with the article and breadcrumb, excluding hidden text.
  const linkText = await currentLink.innerText();
  const title = linkText.trim();
  await expectArticleTitle(article, title);
  const breadcrumbs = page.getByRole("navigation", { name: "パンくずリスト" });
  await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(title);
  expect(await page.title()).toContain(title);
};

export const expectCurrentDocument = async (
  page: Page,
  retention: SidebarRetention,
  path: string,
): Promise<void> => {
  await expect.poll(() => new URL(page.url()).pathname).toBe(path);
  await expectActiveArticle(page, retention.sidebar, path);
  await expectHeadingAnchors(page);
  await expectRetainedSidebar(retention);
};

type SidebarDestination = Readonly<{ path: string; x: number; y: number }>;

export const visibleSidebarDestination = async ({
  retained,
}: SidebarRetention): Promise<SidebarDestination> =>
  retained.evaluate(
    (before, { divisor, inset, linkInset }) => {
      const viewport = before.scroller.getBoundingClientRect();
      const links = [...before.scroller.querySelectorAll<HTMLAnchorElement>("a[href]")];
      const link = links.find((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        const middle = bounds.top + bounds.height / divisor;
        return (
          candidate.pathname !== location.pathname &&
          middle >= viewport.top + inset &&
          middle <= viewport.bottom - inset
        );
      });
      if (!link) {
        throw new DOMException(
          "Expected an already visible sidebar destination",
          "InvalidStateError",
        );
      }
      const bounds = link.getBoundingClientRect();
      return {
        path: link.pathname,
        x: bounds.x + linkInset,
        y: bounds.y + bounds.height / divisor,
      };
    },
    { divisor: midpointDivisor, inset: minimumLinkInset, linkInset: sidebarClickInset },
  );

export const expectLatestSidebarScroll = async ({ retained }: SidebarRetention): Promise<void> => {
  const changedScroll = await retained.evaluate((before) => {
    const previous = before.scrollTop;
    before.scroller.scrollTop = before.scroller.scrollHeight - before.scroller.clientHeight;
    before.scrollTop = before.scroller.scrollTop;
    return before.scrollTop - previous;
  });
  expect(
    changedScroll,
    "History must retain the latest sidebar scroll, not an older entry's snapshot",
  ).toBeGreaterThan(minimumScrollChange);
};
