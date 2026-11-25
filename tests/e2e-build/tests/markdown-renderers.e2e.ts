import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

import { docsTest as test } from "./docs-host.fixture.ts";

const httpStatusOk = 200;
const expectedDiagrams = 2;
const expectedEquations = 2;
const expectedSpecialDiagram = 1;
const monochromeCount = 1;
const noStylesheets = 0;
const narrowViewport = { height: 720, width: 375 };

const openDarkMode = async (page: Page): Promise<void> =>
  page.locator("html").evaluate((element) => {
    element.classList.add("dark");
  });

const expectRichHtml = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("markdown-heading-override")).toHaveText("Markdown manual");
  await expect(page.locator(".math .katex")).toHaveCount(expectedEquations);
  await expect(page.locator(".math").last()).toHaveText("...");
  await expect(page.locator(".mermaid svg")).toHaveCount(expectedDiagrams);
  const labeledDiagram = page
    .locator(".mermaid svg text")
    .filter({ hasText: "marker-end=url(#arrowhead)" });
  await expect(labeledDiagram).toHaveCount(expectedSpecialDiagram);
  const failedDiagram = page.locator(".mermaid").last();
  await expect(failedDiagram).toBeEmpty();
  await expect(failedDiagram).toHaveAttribute("data-error", /.+/u);
};

const expectServerMarkup = async (page: Page): Promise<void> => {
  await expect(page.locator(".footnotes")).toContainText("Footnote detail");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator('blockquote[as="note"]')).toContainText(
    "Markdown links point to source files, not hand-written website routes.",
  );
  const colors = await page
    .locator("pre.shiki code span[style]")
    .evaluateAll((tokens) => [...new Set(tokens.map((token) => getComputedStyle(token).color))]);
  expect(colors.length, "Server-produced Shiki colors remain visible").toBeGreaterThan(
    monochromeCount,
  );
};

const expectLinkedStylesheets = async (page: Page, request: APIRequestContext): Promise<void> => {
  const stylesheets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) =>
      links.flatMap((link) => (link instanceof HTMLLinkElement ? [link.href] : [])),
    );
  expect(
    stylesheets.length,
    "Production document CSS is linked from the built host",
  ).toBeGreaterThan(noStylesheets);
  await Promise.all(
    stylesheets.map(async (href) => {
      const stylesheet = await request.get(href);
      expect(stylesheet.status()).toBe(httpStatusOk);
    }),
  );
};

const expectKatexFont = async (page: Page): Promise<void> => {
  const fontIsReady = async (): Promise<boolean> =>
    page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check("16px KaTeX_Main");
    });
  await expect.poll(fontIsReady).toBe(true);
};

test("renders configured upstream math and diagrams after hydration", async ({ page, request }) => {
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  await expectRichHtml(page);
  await expectServerMarkup(page);
  await expectKatexFont(page);
  await expectLinkedStylesheets(page, request);
  await expect(page.locator(".effront-markdown")).toHaveCSS("color", "rgb(31, 41, 55)");
  await expect(page.locator(".mermaid svg style").first()).toContainText("fonts.googleapis.com");
});

const expectConfiguredDiagram = async (page: Page): Promise<void> => {
  const diagram = page.locator(".custom-mermaid");
  await expect(diagram).toHaveCSS("width", "320px");
  await expect(diagram).toHaveCSS("height", "180px");
  const svg = diagram.locator("svg");
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute("style", /#123456/u);
  await openDarkMode(page);
  await expect(svg).toHaveAttribute("style", /#abcdef/u);
};

test("renders public Math and Mermaid subpaths with upstream props", async ({ page }) => {
  await page.goto("/rich-components");
  await expect(page.locator(".math.inline .katex")).toBeVisible();
  await expectConfiguredDiagram(page);
});

type RgbColor = Readonly<{ blue: number; green: number; red: number }>;
const maximumColorValue = 255;
const linearThreshold = 0.04045;
const linearDivisor = 12.92;
const gammaOffset = 0.055;
const gammaDivisor = 1.055;
const gammaPower = 2.4;
const redWeight = 0.2126;
const greenWeight = 0.7152;
const blueWeight = 0.0722;
const contrastOffset = 0.05;
const minimumBodyContrast = 4.5;
const alertForeground: RgbColor = { blue: 158, green: 148, red: 139 };
const alertBackground: RgbColor = { blue: 0, green: 26, red: 52 };

const linearChannel = (channel: number): number => {
  const normalized = channel / maximumColorValue;
  return normalized <= linearThreshold
    ? normalized / linearDivisor
    : ((normalized + gammaOffset) / gammaDivisor) ** gammaPower;
};

const luminance = ({ red, green, blue }: RgbColor): number =>
  linearChannel(red) * redWeight +
  linearChannel(green) * greenWeight +
  linearChannel(blue) * blueWeight;

const contrast = (foreground: RgbColor, background: RgbColor): number => {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + contrastOffset) / (Math.min(first, second) + contrastOffset);
};

const expectDarkAlertColors = async (page: Page): Promise<void> => {
  const alertColors = await page
    .locator('blockquote[as="warning"], blockquote[as="caution"]')
    .evaluateAll((alerts) =>
      alerts.map((alert) => {
        const style = getComputedStyle(alert);
        return { background: style.backgroundColor, color: style.color };
      }),
    );
  expect(alertColors).toEqual([
    { background: "rgb(52, 26, 0)", color: "rgb(139, 148, 158)" },
    { background: "rgb(52, 26, 0)", color: "rgb(139, 148, 158)" },
  ]);
  expect(
    contrast(alertForeground, alertBackground),
    "Dark warning and caution text meets WCAG AA",
  ).toBeGreaterThanOrEqual(minimumBodyContrast);
};

test("keeps configured MarkdownDocument readable in dark mode and a narrow built host", async ({
  page,
}) => {
  await page.setViewportSize(narrowViewport);
  await page.goto("/manual");
  await openDarkMode(page);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".math .katex").first()).toBeVisible();
  await expect(page.locator(".mermaid svg")).toHaveCount(expectedDiagrams);
  await expect(page.locator(".effront-markdown")).toHaveCSS("color", "rgb(230, 237, 243)");
  await expectDarkAlertColors(page);
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsViewport, "Document styles constrain wide math, diagrams, tables, and code").toBe(
    true,
  );
});
