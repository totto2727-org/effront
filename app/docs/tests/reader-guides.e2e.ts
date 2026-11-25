import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { Reader } from "./reader-journey.browser.fixture.ts";
import { followHeading, openGuide, readers } from "./reader-journey.browser.fixture.ts";

const firstHeadings = ["layouts", "pages", "routes", "application"];
const firstHeading = 0;
const oneExample = 1;

const expectRouteProgression = async (page: Page, reader: Reader): Promise<void> => {
  const ids = await page
    .locator("article h2")
    .evaluateAll((items) => items.map((heading) => heading.id));
  expect(ids.slice(firstHeading, firstHeadings.length)).toEqual(firstHeadings);
  await followHeading(page, reader, "layouts");
  await followHeading(page, reader, "pages");
  await followHeading(page, reader, "routes");
  await followHeading(page, reader, "application");

  const complete = page
    .locator("article pre code")
    .filter({ hasText: "export default EFFRONT.make({ routes })" });
  await expect(complete).toContainText("EFFRONT.Layout.make");
  await expect(complete).toContainText("EFFRONT.Page.make");
  await expect(complete).toContainText('Routes.make({ layout: RootLayout }).page("/", HomePage)');
};

const expectRouteMatching = async (page: Page, reader: Reader): Promise<void> => {
  await expect(page.locator("article")).not.toContainText("127.0.0.1:1340");
  await followHeading(page, reader, "matching");
  await expect(page.locator("article h2#matching")).toHaveText(
    reader.locale === "en" ? "Read path parameters" : "パスパラメーターを受け取る",
  );
  await followHeading(page, reader, "mount");
  const loading = page.locator("article pre code").filter({ hasText: "ArticleLoading" });
  await expect(loading).toContainText('yield* Effect.sleep("2 seconds")');
  await expect(loading).not.toContainText("const HomePage =");
  await expect(loading).toContainText("loading: ArticleLoading");
};

const expectStylingDefaults = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "setup");
  const defaults = page.locator("article pre code").filter({
    hasText: "plugins: [effront(), effrontServer(), effrontTailwind()]",
  });
  await expect(defaults).toHaveCount(oneExample);
  await expect(defaults).toContainText('from "@effront/tailwind"');
  await expect(defaults).toContainText("plugins: [effront(), effrontServer(), effrontTailwind()]");
  await expect(defaults).not.toContainText("stylesheet:");
  await expect(page.locator("article")).not.toContainText("stylingPlugins");
  await expect(
    page.locator("article pre code").filter({ hasText: 'className="p-4 text-xl font-bold"' }),
  ).toBeVisible();
};

const expectStylingCustomization = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "stylesheet");
  await expect(
    page.locator("article pre code").filter({ hasText: 'stylesheet: "./src/styles.css"' }),
  ).toBeVisible();
  const theme = page.locator("article pre code").filter({ hasText: "--color-brand" });
  await expect(theme).toContainText('@import "tailwindcss"');
  await expect(theme).toContainText("@theme");
  await followHeading(page, reader, "scope");
  await expect(page.locator("article h2#scope")).toHaveText(/optional|必要に応じて/u);
  await expect(
    page.locator("article pre code").filter({ hasText: '@plugin "@tailwindcss/typography"' }),
  ).toBeVisible();
};

const expectTailwindReference = async (page: Page, reader: Reader): Promise<void> => {
  const path = `/${reader.locale}/api-reference/tailwind`;
  await page.locator(`article a[href="${path}"]`).click();
  await expect(page).toHaveURL(path);
  await expect(page.locator("article h2#stylesheet")).toHaveText("stylesheet");
  await expect(
    page.locator("article").getByRole("row").filter({ hasText: "undefined" }),
  ).toContainText(/default|既定/u);
};

readers.forEach((reader) => {
  test(`${reader.locale} reader learns Layout, Page and Routes before the complete registration`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/routes");
    await expectRouteProgression(page, reader);
    await expectRouteMatching(page, reader);
  });

  test(`${reader.locale} reader distinguishes default Tailwind setup from optional customization`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/styling");
    await expectStylingDefaults(page, reader);
    await expectStylingCustomization(page, reader);
    await expectTailwindReference(page, reader);
  });
});
