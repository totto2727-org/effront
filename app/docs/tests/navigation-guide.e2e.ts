import { expect, test } from "@playwright/test";

for (const locale of ["en", "ja"] as const) {
  test(`${locale} reader finds client navigation directly under Guides and configures Page animations`, async ({
    page,
  }) => {
    const path = `/${locale}/advanced/client-navigation`;
    await page.goto(`/${locale}`);
    const guides = page.getByRole("list", { name: "Guides", exact: true });
    const directLink = guides.locator(`:scope > li > a[href="${path}"]`);
    await expect(directLink).toHaveCount(1);
    await expect(guides.getByRole("list").locator(`a[href="${path}"]`)).toHaveCount(0);
    await directLink.click();
    await expect(page).toHaveURL(path);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    const article = page.locator("article");
    expect(
      await article.locator("h2").evaluateAll((headings) => headings.map((h) => h.id)),
    ).toEqual([
      "native-navigation",
      "transition-scope",
      "global-config",
      "commit-and-stream",
      "history-cache",
    ]);
    const toc = page.getByRole("complementary", {
      name: locale === "en" ? "On this page" : "このページ内",
    });
    await toc.locator('a[href="#transition-scope"]').click();
    await expect(article.locator("h2#transition-scope")).toBeInViewport();
    const disabled = article.locator("pre code").filter({ hasText: "viewTransition: false" });
    await expect(disabled).toContainText('import { Effect } from "effect"');
    await expect(disabled).toContainText('import { EFFRONT } from "./effront"');
    await expect(disabled).toContainText("EFFRONT.Page.make");
    await expect(disabled).toContainText("render: () => Effect.succeed(<h1>Settings</h1>)");

    await toc.locator('a[href="#global-config"]').click();
    await expect(article.locator("h2#global-config")).toBeInViewport();
    const application = article.locator("pre code").filter({ hasText: "EFFRONT.make" });
    await expect(application).toContainText('import { PageViewTransition } from "@effront/core"');
    await expect(application).toContainText('import { Layer } from "effect"');
    await expect(application).toContainText(
      "layer: Layer.succeed(PageViewTransition, { enabled: false })",
    );
    await expect(
      article.locator("pre code").filter({ hasText: "viewTransition: { enabled: true }" }),
    ).toHaveCount(1);

    const notes = article.locator('[data-alert="note"]');
    await expect(notes).toHaveCount(3);
    await expect(notes.locator(".docs-alert-title")).toHaveText(["Note", "Note", "Note"]);
    await expect(article).not.toContainText("[!NOTE]");
    await expect(
      notes.filter({ hasText: locale === "en" ? "reduced-motion" : "動きを減らす" }),
    ).toContainText(locale === "en" ? "input state or focus" : "入力状態やフォーカス");
    await expect(article).not.toContainText("data-effront-transition-types");
    await expect(article).not.toContainText("hmr-refresh");

    const other = locale === "en" ? "ja" : "en";
    await page.locator(`a[hreflang="${other}"]`).click();
    await expect(page).toHaveURL(`/${other}/advanced/client-navigation`);
    await expect(page.locator("html")).toHaveAttribute("lang", other);
    await page.locator(`a[hreflang="${locale}"]`).click();
    await expect(page).toHaveURL(path);
    await article.locator(`a[href="/${locale}/api-reference/components#view-transition"]`).click();
    await expect(page).toHaveURL(`/${locale}/api-reference/components#view-transition`);
    await expect(article.locator("h2#view-transition")).toBeInViewport();
    await expect(article).toContainText("data-effront-transition-types");
    await expect(article).toContainText("photo-fade");
  });
}
