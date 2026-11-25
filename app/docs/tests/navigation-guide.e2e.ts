import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { Reader } from "./reader-journey.browser.fixture.ts";
import { followHeading, readers } from "./reader-journey.browser.fixture.ts";

const guide = "/advanced/client-navigation";
const titleLinkCount = 1;
const noNestedLinks = 0;
const pageOverrideCount = 1;
const noteTitles = ["Note", "Note", "Note"];

const openNavigationGuide = async (page: Page, reader: Reader): Promise<void> => {
  const path = `/${reader.locale}${guide}`;
  await page.goto(`/${reader.locale}`);
  const guides = page.getByRole("list", { exact: true, name: "Guides" });
  const directLink = guides.locator(`:scope > li > a[href="${path}"]`);
  await expect(directLink).toHaveCount(titleLinkCount);
  await expect(guides.getByRole("list").locator(`a[href="${path}"]`)).toHaveCount(noNestedLinks);
  await directLink.click();
  await expect(page).toHaveURL(path);
  await expect(page.locator("html")).toHaveAttribute("lang", reader.locale);
};

const expectPageExample = async (page: Page, reader: Reader): Promise<void> => {
  const article = page.locator("article");
  const ids = await article
    .locator("h2")
    .evaluateAll((headings) => headings.map((heading) => heading.id));
  expect(ids).toEqual([
    "native-navigation",
    "transition-scope",
    "global-config",
    "commit-and-stream",
    "history-cache",
  ]);
  await followHeading(page, reader, "transition-scope");
  const disabled = article.locator("pre code").filter({ hasText: "viewTransition: false" });
  await expect(disabled).toContainText('import { Effect } from "effect"');
  await expect(disabled).toContainText('import { EFFRONT } from "./effront"');
  await expect(disabled).toContainText("EFFRONT.Page.make");
  await expect(disabled).toContainText("render: () => Effect.succeed(<h1>Settings</h1>)");
};

const expectApplicationExample = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "global-config");
  const code = page.locator("article pre code");
  const application = code.filter({ hasText: "EFFRONT.make" });
  await expect(application).toContainText('import { PageViewTransition } from "@effront/core"');
  await expect(application).toContainText('import { Layer } from "effect"');
  await expect(application).toContainText(
    "layer: Layer.succeed(PageViewTransition, { enabled: false })",
  );
  await expect(code.filter({ hasText: "viewTransition: { enabled: true }" })).toHaveCount(
    pageOverrideCount,
  );
};

const expectNavigationNotes = async (page: Page, reader: Reader): Promise<void> => {
  const article = page.locator("article");
  const notes = article.locator('[data-alert="note"]');
  await expect(notes).toHaveCount(noteTitles.length);
  await expect(notes.locator(".docs-alert-title")).toHaveText(noteTitles);
  await expect(article).not.toContainText("[!NOTE]");
  await expect(
    notes.filter({ hasText: reader.locale === "en" ? "reduced-motion" : "動きを減らす" }),
  ).toContainText(reader.locale === "en" ? "input state or focus" : "入力状態やフォーカス");
  await expect(article).not.toContainText("data-effront-transition-types");
  await expect(article).not.toContainText("hmr-refresh");
};

const switchGuideLocale = async (page: Page, reader: Reader): Promise<void> => {
  const other = reader.locale === "en" ? "ja" : "en";
  await page.locator(`a[hreflang="${other}"]`).click();
  await expect(page).toHaveURL(`/${other}${guide}`);
  await expect(page.locator("html")).toHaveAttribute("lang", other);
  await page.locator(`a[hreflang="${reader.locale}"]`).click();
  await expect(page).toHaveURL(`/${reader.locale}${guide}`);
};

const expectTransitionReference = async (page: Page, reader: Reader): Promise<void> => {
  const path = `/${reader.locale}/api-reference/components#view-transition`;
  const article = page.locator("article");
  await article.locator(`a[href="${path}"]`).click();
  await expect(page).toHaveURL(path);
  await expect(article.locator("h2#view-transition")).toBeInViewport();
  await expect(article).toContainText("data-effront-transition-types");
  await expect(article).toContainText("photo-fade");
};

readers.forEach((reader) => {
  test(`${reader.locale} reader finds client navigation directly under Guides and configures Page animations`, async ({
    page,
  }) => {
    await openNavigationGuide(page, reader);
    await expectPageExample(page, reader);
    await expectApplicationExample(page, reader);
    await expectNavigationNotes(page, reader);
    await switchGuideLocale(page, reader);
    await expectTransitionReference(page, reader);
  });
});
