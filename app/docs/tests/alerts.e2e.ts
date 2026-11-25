import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { readAlertContrast } from "./alert-colors.browser.fixture.ts";
import { alertTitles, buildAlertFixture } from "./alerts.fixture.ts";
import type { AlertTitle } from "./alerts.fixture.ts";

const fixture = { markup: "" };
const themes = ["light", "dark"] as const;
const minimumTextContrast = 4.5;
const expectedAlertColors = 5;
const expectedQuotations = 1;
const expectedQuotationAlerts = 0;

test.beforeAll(async () => {
  fixture.markup = await buildAlertFixture();
});

const loadStyledAlerts = async (page: Page, theme: (typeof themes)[number]): Promise<void> => {
  await page.goto("/en/guide/components");
  // Render the local fixture using the real built documentation stylesheet.
  await page.locator("article").evaluate((article, html) => {
    article.innerHTML = html;
  }, fixture.markup);
  await page.evaluate(
    (dark) => document.documentElement.classList.toggle("dark", dark),
    theme === "dark",
  );
};

const verifyVisibleAlert = async (alert: Locator, title: AlertTitle): Promise<void> => {
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAttribute("aria-label", title);
  await expect(alert.locator(".docs-alert-title")).toHaveText(title);
  const icon = alert.locator(".docs-alert-title svg");
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute("aria-hidden", "true");
  await expect(alert).not.toContainText(`[!${title.toUpperCase()}]`);
};

const verifyAlert = async (page: Page, title: AlertTitle): Promise<string> => {
  const alert = page.locator(`article [data-alert="${title.toLowerCase()}"]`);
  await verifyVisibleAlert(alert, title);
  const style = await readAlertContrast(alert);
  expect(style.border).toBe(style.title);
  expect(style.titleContrast).toBeGreaterThanOrEqual(minimumTextContrast);
  expect(style.bodyContrast).toBeGreaterThanOrEqual(minimumTextContrast);
  return style.title;
};

const verifyPalette = async (page: Page): Promise<void> => {
  const colors = new Set<string>();
  // oxlint-disable-next-line rules/no-for-loops -- Keep browser assertions and Canvas measurements serial on the shared worker.
  for (const title of alertTitles) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Measure one alert at a time in this browser page.
    const color = await verifyAlert(page, title);
    colors.add(color);
  }
  expect(colors.size).toBe(expectedAlertColors);
};

const verifyQuotation = async (page: Page): Promise<void> => {
  const quotation = page.locator("article blockquote");
  await expect(quotation).toHaveCount(expectedQuotations);
  await expect(quotation).toContainText("An ordinary quotation.");
  await expect(quotation).not.toHaveAttribute("data-alert");
  await expect(quotation.locator("svg, .docs-alert-title")).toHaveCount(expectedQuotationAlerts);
};

themes.forEach((theme) => {
  test(`all five Comark alerts have readable labels, icons and distinct ${theme} colors`, async ({
    page,
  }, testInfo) => {
    await loadStyledAlerts(page, theme);
    await verifyPalette(page);
    await verifyQuotation(page);
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`alerts-${theme}.png`) });
  });
});
