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
  test(`${reader.locale} reader finds the clone-and-run sample and its file roles`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/getting-started");
    await followHeading(page, reader, "setup");
    const commands = page.locator("article pre code").filter({ hasText: "git clone" });
    await expect(commands).toHaveText(
      "git clone https://github.com/totto2727-org/effront.git\ncd effront/examples/hello-world\nvp install\nnode --run dev",
    );
    await expect(page.locator('article a[href="http://127.0.0.1:1340"]')).toBeVisible();
    await expect(
      page.locator(
        'article a[href="https://github.com/totto2727-org/effront/tree/main/examples/hello-world"]',
      ),
    ).toBeVisible();
    await followHeading(page, reader, "application");
    for (const file of [
      "src/entry.effront.tsx",
      "src/entry.rsc.ts",
      "src/entry.server.ts",
      "vite.config.ts",
      "package.json",
    ]) {
      await expect(
        page.locator("article table").getByRole("row").filter({ hasText: file }),
      ).toBeVisible();
    }
    await followHeading(page, reader, "run");
    await expect(
      page.locator("article pre code").filter({ hasText: "<h1>Hello, world</h1>" }),
    ).toBeVisible();
    await expect(
      page.locator("article pre code").filter({ hasText: "<h1>Hello, Effront</h1>" }),
    ).toBeVisible();
  });

  for (const [host, example, dev, preview] of [
    ["node", "node", "http://127.0.0.1:1341", "http://127.0.0.1:4341"],
    ["bun", "bun", "http://127.0.0.1:1342", "http://127.0.0.1:4342"],
    ["cloudflare", "workers", "http://127.0.0.1:1343", "http://127.0.0.1:4343"],
    ["alchemy", "alchemy", "http://localhost:1337", null],
  ] as const) {
    test(`${reader.locale} reader runs the existing ${host} example without assembling host configuration`, async ({
      page,
    }) => {
      await page.goto(`/${reader.locale}/platforms`);
      await page.locator(`article a[href="/${reader.locale}/platforms/${host}"]`).click();
      await expect(page).toHaveURL(`/${reader.locale}/platforms/${host}`);
      await expect(
        page.locator(
          `article a[href="https://github.com/totto2727-org/effront/tree/main/examples/${example}"]`,
        ),
      ).toBeVisible();
      await followHeading(page, reader, "setup");
      const commands = page.locator("article pre code").filter({ hasText: "git clone" });
      await expect(commands).toContainText(`cd examples/${example}`);
      await expect(commands).toContainText('vp exec --filter "./packages/*" -- vp pack');
      await expect(page.locator(`article a[href="${dev}"]`).first()).toBeVisible();
      for (const file of ["src/entry.effront.tsx", "vite.config.ts", "package.json"]) {
        await expect(
          page.locator("article table").getByRole("row").filter({ hasText: file }),
        ).toBeVisible();
      }
      if (preview) {
        await expect(page.locator(`article a[href="${preview}"]`)).toBeVisible();
        await expect(page.locator("article pre code").filter({ hasText: "vp preview" })).toHaveText(
          "vp build\nvp preview",
        );
      }
      if (host === "node" || host === "bun") {
        await followHeading(page, reader, host);
        await expect(
          page.locator("article pre code").filter({ hasText: /^vp run start$/ }),
        ).toBeVisible();
        await expect(page.locator("article")).toContainText(`${host} dist/rsc/server.js`);
        await expect(page.locator('article a[href="http://127.0.0.1:3000"]')).toBeVisible();
        const other = reader.locale === "en" ? "ja" : "en";
        await page.locator(`a[hreflang="${other}"]`).click();
        await expect(page).toHaveURL(`/${other}/platforms/${host}`);
        await expect(page.locator("html")).toHaveAttribute("lang", other);
      }
    });
  }

  test(`${reader.locale} reader learns Layout, Page and Routes before the complete registration`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/routes");
    const ids = await page
      .locator("article h2")
      .evaluateAll((headings) => headings.map((heading) => heading.id));
    expect(ids.slice(0, 4)).toEqual(["layouts", "pages", "routes", "application"]);
    for (const id of ids.slice(0, 4)) await followHeading(page, reader, id);
    const complete = page
      .locator("article pre code")
      .filter({ hasText: "export default EFFRONT.make({ routes })" });
    await expect(complete).toContainText("EFFRONT.Layout.make");
    await expect(complete).toContainText("EFFRONT.Page.make");
    await expect(complete).toContainText('Routes.make({ layout: RootLayout }).page("/", HomePage)');
    await expect(page.locator('article a[href="http://127.0.0.1:1340"]')).toHaveCount(2);
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
