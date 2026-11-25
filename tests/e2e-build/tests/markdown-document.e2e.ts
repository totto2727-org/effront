// oxlint-disable-next-line rules/no-node-imports -- The linked SVG must match the checked-in fixture byte for byte.
import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { Data, Predicate, String } from "effect";

import { docsTest as test } from "./docs-host.fixture.ts";
import {
  expectArticleTitle,
  headingSelector,
  manualArticle,
  requireHref,
} from "./layout-assertions.browser.fixture.ts";
import { destinations, unicodePath } from "./markdown-destinations.fixture.ts";

const httpStatusOk = 200;
const emptyCount = 0;
const placeholderCount = 3;
const expectedCheckboxCount = 2;
const monochromeColorCount = 1;

class LinkedImageMissing extends Data.TaggedError("LinkedImageMissing")<{ message: string }> {}

const verifyFootnote = async (page: Page): Promise<void> => {
  const notes = page.locator(".footnotes");
  await expect(notes).toBeVisible();
  await expect(notes).toContainText("Footnote detail");
  const link = page.locator('sup a[href^="#"]').first();
  await expect(link).toBeVisible();
  const href = await requireHref(link, "A footnote must link to its rendered definition");
  await expect(page.locator(headingSelector(href))).toContainText("Footnote detail");
  await link.click();
  await expect.poll(() => new URL(page.url()).hash).toBe(href);
};

const verifyClientPlaceholderMarkup = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("markdown-heading-override")).toHaveText("Markdown manual");
  await expect(page.locator(".math")).toHaveText(["...", "...", "..."]);
  const mermaid = page.locator(".mermaid");
  await expect(mermaid).toHaveCount(placeholderCount);
  await expect(mermaid).toHaveText(["", "", ""]);
  await expect(page.locator(".katex, .mermaid svg")).toHaveCount(emptyCount);
};

const verifySyntaxAndTaskMarkup = async (page: Page): Promise<void> => {
  const code = page.locator("pre.shiki").first();
  await expect(code).toBeVisible();
  await expect(code.locator("code")).toHaveText('const message: string = "Hello Markdown";');
  const colors = await code
    .locator("code span[style]")
    .evaluateAll((tokens) => [...new Set(tokens.map((token) => getComputedStyle(token).color))]);
  expect(colors.length, "Syntax colors apply without a browser highlighter").toBeGreaterThan(
    monochromeColorCount,
  );
  const tasks = page.getByRole("checkbox");
  await expect(tasks).toHaveCount(expectedCheckboxCount);
  await expect(tasks.first()).toBeDisabled();
  await expect(tasks.first()).toBeChecked();
  await expect(tasks.last()).not.toBeChecked();
};

const verifyTableAndCallout = async (page: Page): Promise<void> => {
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator('blockquote[as="note"]')).toContainText(
    "Markdown links point to source files, not hand-written website routes.",
  );
  expect(await page.locator("blockquote").allTextContents()).not.toContain("[!NOTE]");
};

const findLink = (article: Locator, name: string): Locator =>
  article.getByRole("link", { exact: true, name });

const linkDestinations = [
  { href: "/manual/guide/getting-started?from=manual#installation", name: "Getting started" },
  { href: "/manual/guide/deep/details", name: "Deep details" },
  { href: `${unicodePath}?from=manual#details`, name: "Unicode page" },
  { href: "https://example.com/reference?q=markdown#section", name: "External reference" },
];

const verifyLinkDestinations = async (article: Locator): Promise<void> => {
  await Promise.all(
    linkDestinations.map(async ({ href, name }) => {
      await expect(findLink(article, name)).toHaveAttribute("href", href);
    }),
  );
};

const getImageSource = async (image: Locator): Promise<string> => {
  const src = await image.getAttribute("src");
  if (Predicate.isNullish(src) || String.isEmpty(src)) {
    throw new LinkedImageMissing({
      message: "The Markdown image must resolve to a public asset URL",
    });
  }
  return src;
};

const verifyAssetBytes = async (request: APIRequestContext, href: string): Promise<void> => {
  const asset = await request.get(href);
  expect(asset.status()).toBe(httpStatusOk);
  expect(asset.headers()["content-type"]).toMatch(/^image\//u);
  const fixturePath = new URL("../fixture/content/manual/images/diagram.svg", import.meta.url);
  expect(await asset.body()).toEqual(await readFile(fixturePath));
};

const verifyDecodedImage = async (image: Locator): Promise<void> => {
  const naturalWidth = async (): Promise<number> =>
    image.evaluate((element: HTMLImageElement) => element.naturalWidth);
  const imageIsComplete = async (): Promise<boolean> =>
    image.evaluate((element: HTMLImageElement) => element.complete);
  await expect.poll(naturalWidth).toBeGreaterThan(emptyCount);
  await expect.poll(imageIsComplete).toBe(true);
};

const openStaticManual = async (page: Page): Promise<void> => {
  const response = await page.goto("/manual");
  expect(response?.status()).toBe(httpStatusOk);
  expect(response?.headers()["content-type"]).toContain("text/html");
  await expectArticleTitle(manualArticle(page), "Markdown manual");
  const features = page.getByRole("heading", { exact: true, name: "Features" });
  await expect(features).toHaveAttribute("id", "features");
};

const verifyLocalSectionLink = async (page: Page, article: Locator): Promise<void> => {
  const localSection = findLink(article, "Local section");
  await expect(localSection).toHaveAttribute("href", "#features");
  await localSection.click();
  await expect.poll(() => new URL(page.url()).hash).toBe("#features");
  await expect(page.locator("#features")).toBeInViewport();
};

test.describe("Markdown without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders default Markdown plugins in the original server document", async ({ page }) => {
    await openStaticManual(page);
    await verifyFootnote(page);
    await verifyClientPlaceholderMarkup(page);
    await verifySyntaxAndTaskMarkup(page);
    await verifyTableAndCallout(page);
    await expect(page.getByRole("button", { exact: true, name: "Count: 0" })).toBeVisible();
  });

  test("maps source references to public URLs while retaining suffixes and external URLs", async ({
    page,
  }) => {
    await page.goto("/manual");
    const article = manualArticle(page);
    await verifyLinkDestinations(article);
    await verifyLocalSectionLink(page, article);
    await findLink(article, "Getting started").click();
    await expect(page).toHaveURL(/\/manual\/guide\/getting-started\?from=manual#installation$/u);
    await expect(page.locator("#installation")).toBeVisible();
  });
});

test.describe("Markdown assets and nested pages without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("serves a source-linked image as real Vite asset bytes and a decoded browser image", async ({
    page,
    request,
  }) => {
    await page.goto("/manual");
    const image = page.getByRole("img", { exact: true, name: "Markdown diagram" });
    await expect(image).toBeVisible();
    const src = await getImageSource(image);
    expect(src).not.toMatch(/^(?:data:|file:)/u);
    await verifyAssetBytes(request, new URL(src, page.url()).href);
    await verifyDecodedImage(image);
  });

  destinations.forEach(({ hash, path, title }) => {
    test(`directly serves nested source page ${title}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(httpStatusOk);
      const article = manualArticle(page);
      await expectArticleTitle(article, title);
      if (Predicate.isNotNullish(hash)) {
        await expect(page.locator(headingSelector(`#${hash}`))).toBeVisible();
      }
      await expect(findLink(article, "Manual home")).toHaveAttribute("href", "/manual");
    });
  });
});
