import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const readers = [
  { locale: "en", toc: "On this page" },
  { locale: "ja", toc: "このページ内" },
] as const;

export type Reader = (typeof readers)[number];

const articleHeading = 1;
const minimumTokenColors = 2;

export const openGuide = async (page: Page, reader: Reader, slug: string): Promise<void> => {
  await page.goto(`/${reader.locale}`);
  await page
    .getByRole("list", {
      exact: true,
      name: slug === "/guide/getting-started" ? "Getting started" : "Guides",
    })
    .locator(`a[href="/${reader.locale}${slug}"]`)
    .click();
  await expect(page).toHaveURL(`/${reader.locale}${slug}`);
  await expect(page.locator("html")).toHaveAttribute("lang", reader.locale);
  await expect(
    page.locator("article").getByRole("heading", { level: articleHeading }),
  ).toBeVisible();
};

export const followHeading = async (page: Page, reader: Reader, id: string): Promise<void> => {
  await page.getByRole("complementary", { name: reader.toc }).locator(`a[href="#${id}"]`).click();
  await expect(page.locator(`article h2#${id}`)).toBeInViewport();
};

export const expectSyntaxColors = async (code: Locator): Promise<void> => {
  const colors = await code
    .locator("span[style]")
    .evaluateAll((tokens) =>
      [
        ...new Set(
          tokens
            .filter((token) => token instanceof HTMLElement)
            .map((token) => token.style.getPropertyValue("--shiki-dark")),
        ),
      ].filter(Boolean),
    );
  expect(colors.length).toBeGreaterThan(minimumTokenColors);
};

export const expectFileRows = async (page: Page, files: Readonly<string[]>): Promise<void> => {
  await Promise.all(
    files.map(async (file) =>
      expect(
        page.locator("article table").getByRole("row").filter({ hasText: file }),
      ).toBeVisible(),
    ),
  );
};
