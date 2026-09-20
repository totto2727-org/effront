import { expect, test, type Page } from "@playwright/test";

const locales = [
  { locale: "en", toc: "On this page" },
  { locale: "ja", toc: "このページ内" },
] as const;

type ReaderLocale = (typeof locales)[number];

async function openGuide(page: Page, reader: ReaderLocale, slug: string) {
  await page.goto(`/${reader.locale}`);
  await page
    .getByRole("list", {
      name: slug === "/guide/getting-started" ? "Getting started" : "Guides",
      exact: true,
    })
    .locator(`a[href="/${reader.locale}${slug}"]`)
    .click();
  await expect(page).toHaveURL(`/${reader.locale}${slug}`);
  await expect(page.locator("html")).toHaveAttribute("lang", reader.locale);
  await expect(page.locator("article").getByRole("heading", { level: 1 })).toBeVisible();
}

async function followHeading(page: Page, reader: ReaderLocale, id: string) {
  await page.getByRole("complementary", { name: reader.toc }).locator(`a[href="#${id}"]`).click();
  await expect(page.locator(`article h2#${id}`)).toBeInViewport();
}

for (const reader of locales) {
  test(`${reader.locale} reader finds a complete minimum homepage registration`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/getting-started");
    await followHeading(page, reader, "application");
    const example = page.locator("article pre code").filter({ hasText: "Application.effront()" });
    await expect(example).toHaveCount(1);
    await expect(example).toContainText('import { Application } from "@effront/core"');
    await expect(example).toContainText('import { Effect } from "effect"');
    await expect(example).toContainText("EFFRONT.Layout.make(");
    await expect(example).toContainText("EFFRONT.Page.make(");
    await expect(example).toContainText("<body>");
    await expect(example).toContainText("{children}");
    await expect(example).toContainText("<h1>Hello, Effront</h1>");
    await expect(example).toContainText("export default EFFRONT.make(");
    await expect(example).toContainText('Routes.make({ layout: RootLayout }).page("/", HomePage)');
    await followHeading(page, reader, "run");
    await expect(
      page
        .locator("article code")
        .filter({ hasText: /^Hello, Effront$/ })
        .last(),
    ).toBeVisible();
  });

  test(`${reader.locale} reader chooses Node.js and finds development and production start commands`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/getting-started");
    const install = page.locator("article pre code").filter({ hasText: "vp add @effront/core" });
    await expect(install).not.toContainText(/@effront\/(cloudflare|alchemy|server)|wrangler/);
    await followHeading(page, reader, "files");
    await page.locator(`article a[href="/${reader.locale}/platforms/node-bun#setup"]`).click();
    await expect(page).toHaveURL(`/${reader.locale}/platforms/node-bun#setup`);
    await followHeading(page, reader, "entries");
    await expect(page.locator("article pre code").filter({ hasText: /^vp dev\s*$/ })).toBeVisible();
    await followHeading(page, reader, "node");
    const startup = page.locator("article pre code").filter({ hasText: "node dist/rsc/server.js" });
    await expect(startup).toHaveText(/vp build\s+node dist\/rsc\/server\.js/);
    const server = page.locator("article pre code").filter({ hasText: "NodeRuntime.runMain" });
    await expect(server).toContainText('from "@effront/server/node"');
    await expect(server).toContainText('hostname: "127.0.0.1"');
    await expect(server).toContainText('new URL("../client/assets", import.meta.url)');
    await expect(server).toContainText('prefix: "/assets/"');
  });

  test(`${reader.locale} reader distinguishes default Tailwind setup from optional customization`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/styling");
    await followHeading(page, reader, "setup");
    const defaults = page.locator("article pre code").filter({ hasText: "effrontTailwind()" });
    await expect(defaults).toHaveCount(1);
    await expect(defaults).toContainText('from "@effront/tailwind"');
    await expect(defaults).toContainText(/^\s*const\s+\w+\s*=\s*\[effrontTailwind\(\)\]/m);
    await expect(defaults).not.toContainText("stylesheet:");
    await expect(
      page.locator("article code").filter({ hasText: /^\.\.\.stylingPlugins$/ }),
    ).toBeVisible();
    await expect(
      page.locator("article pre code").filter({ hasText: 'className="p-4 text-xl font-bold"' }),
    ).toBeVisible();
    await followHeading(page, reader, "stylesheet");
    await expect(
      page.locator("article pre code").filter({ hasText: 'stylesheet: "./src/styles.css"' }),
    ).toBeVisible();
    const theme = page.locator("article pre code").filter({ hasText: "--color-brand" });
    await expect(theme).toContainText('@import "tailwindcss"');
    await expect(theme).toContainText("@theme");
    await followHeading(page, reader, "scope");
    await expect(page.locator("article h2#scope")).toHaveText(/optional|必要に応じて/);
    await expect(
      page.locator("article pre code").filter({ hasText: '@plugin "@tailwindcss/typography"' }),
    ).toBeVisible();
    await page.locator(`article a[href="/${reader.locale}/api-reference/tailwind"]`).click();
    await expect(page).toHaveURL(`/${reader.locale}/api-reference/tailwind`);
    await expect(page.locator("article h2#stylesheet")).toHaveText("stylesheet");
    await expect(
      page.locator("article").getByRole("row").filter({ hasText: "undefined" }),
    ).toContainText(/default|既定/);
  });

  test(`${reader.locale} reader follows Markdown configuration to defaults, extensions and safety limits`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/markdown");
    await followHeading(page, reader, "authoring");
    const article = page.locator("article");
    await expect(article.locator("code").filter({ hasText: "linkify: false" })).toBeVisible();
    const extension = article.locator("pre code").filter({ hasText: "plugins: [toc()]" });
    await expect(extension).toContainText('import toc from "comark/plugins/toc"');
    await expect(extension).toContainText("parseMarkdown(entry,");
    await article.locator(`a[href="/${reader.locale}/api-reference/markdown#parse"]`).click();
    await expect(page).toHaveURL(`/${reader.locale}/api-reference/markdown#parse`);
    await expect(page.locator("article h2#parse")).toHaveText("parseMarkdown");
    await expect(page.locator("article h2#parse")).toBeInViewport();
    for (const plugin of ["footnotes()", "math()", "mermaid({", "shiki()"]) {
      await expect(article.getByRole("row").filter({ hasText: plugin })).toBeVisible();
    }
    await expect(article.locator("code").filter({ hasText: /^ParserOptions$/ })).toBeVisible();
    const options = article.locator("p").filter({ hasText: "options.plugins" });
    await expect(options).toContainText(/appended after|後に追加/);
    await expect(options).toContainText(/not substituted|置き換えにはなりません/);
    await expect(article).toContainText(/No option removes|削除するオプションはありません/);
    await expect(
      article.locator("code").filter({ hasText: "registerDefaultPlugins: false" }),
    ).toBeVisible();
    await expect(article.locator("p").filter({ hasText: "sanitizer" })).toContainText(
      /not a sanitizer|sanitizer ではありません/,
    );
    await expect(article.locator("p").filter({ hasText: "Comark 0.6.2" })).toContainText(
      /does not automatically register|自動登録せず/,
    );
    await expect(article.locator('a[href="https://comark.dev"]')).toBeVisible();
    await expect(article.locator('a[href="https://comark.dev/rendering/react"]')).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", reader.locale);
  });
}
