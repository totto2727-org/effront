import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite-plus";

const types = ["Note", "Tip", "Important", "Warning", "Caution"] as const;
let fixture: string;

test.beforeAll(async () => {
  const markdown = [
    "> An ordinary quotation.",
    ...types.map(
      (type) => `> [!${type.toUpperCase()}]\n> ${type} content with **readable details**.`,
    ),
  ].join("\n\n");
  const collection = await Effect.runPromise(
    createMarkdownCollection({ basePath: "/", documents: { "./alerts.md": markdown } }),
  );
  const entry = collection.get("/alerts");
  if (!entry) throw new TypeError("Alert fixture is missing");
  const document = await Effect.runPromise(parseMarkdown(entry));
  // Playwright rewrites imported JSX for component tests. Vite's SSR loader
  // preserves ordinary React elements from the actual production component.
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const { markdownAlertComponents } = await vite.ssrLoadModule(
      "/src/components/markdown-alert.tsx",
    );
    fixture = renderToStaticMarkup(
      createElement(MarkdownDocument, {
        value: document,
        className: "docs-markdown",
        components: markdownAlertComponents,
      }),
    );
  } finally {
    await vite.close();
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`all five Comark alerts have readable labels, icons and distinct ${theme} colors`, async ({
    page,
  }, testInfo) => {
    await page.goto("/en/guide/components");
    // Render the production parser/component fixture under the real site stylesheet,
    // without adding a fixture route to the public documentation application.
    await page.locator("article").evaluate((article, html) => {
      article.innerHTML = html;
    }, fixture);
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      theme === "dark",
    );
    const colors = new Set<string>();
    for (const type of types) {
      const alert = page.locator(`article [data-alert="${type.toLowerCase()}"]`);
      await expect(alert).toBeVisible();
      await expect(alert).toHaveAttribute("aria-label", type);
      await expect(alert.locator(".docs-alert-title")).toHaveText(type);
      await expect(alert.locator(".docs-alert-title svg")).toBeVisible();
      await expect(alert.locator(".docs-alert-title svg")).toHaveAttribute("aria-hidden", "true");
      await expect(alert).not.toContainText(`[!${type.toUpperCase()}]`);
      const style = await alert.evaluate((element) => {
        const title = element.querySelector(".docs-alert-title");
        const body = element.querySelector(".docs-alert-body");
        if (!title || !body) throw new TypeError("Alert fixture structure is missing");
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new TypeError("Canvas color conversion is unavailable");
        const luminance = (color: string) => {
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
            .slice(0, 3)
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
          return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
        };
        const background = luminance(
          getComputedStyle(document.documentElement).getPropertyValue("--background"),
        );
        const contrast = (color: string) => {
          const foreground = luminance(color);
          return (
            (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
          );
        };
        const titleColor = getComputedStyle(title).color;
        return {
          border: getComputedStyle(element).borderInlineStartColor,
          title: titleColor,
          titleContrast: contrast(titleColor),
          bodyContrast: contrast(getComputedStyle(body).color),
        };
      });
      expect(style.border).toBe(style.title);
      expect(style.titleContrast).toBeGreaterThanOrEqual(4.5);
      expect(style.bodyContrast).toBeGreaterThanOrEqual(4.5);
      colors.add(style.title);
    }
    expect(colors.size).toBe(5);
    const quotation = page.locator("article blockquote");
    await expect(quotation).toHaveCount(1);
    await expect(quotation).toContainText("An ordinary quotation.");
    await expect(quotation).not.toHaveAttribute("data-alert");
    await expect(quotation.locator("svg, .docs-alert-title")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`alerts-${theme}.png`), fullPage: true });
  });
}
