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
  test(`${reader.locale} reader starts with a direct form before adding action state`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/server-functions");
    expect(
      await page
        .locator("article h2")
        .evaluateAll((headings) => headings.map((heading) => heading.id)),
    ).toEqual(["identity", "forms", "application", "state", "input", "refresh", "errors"]);
    await followHeading(page, reader, "forms");
    const handler = page.locator("article pre code").filter({ hasText: "export const recordName" });
    await expect(handler).toContainText('Effect.logInfo("Name submitted", { name })');
    await followHeading(page, reader, "application");
    await expect(
      page.locator("article pre code").filter({ hasText: "<form action={recordName}>" }),
    ).toContainText("Record name");
    await followHeading(page, reader, "state");
    const state = page.locator("article pre code").filter({ hasText: "useActionState(greet" });
    await expect(state).toContainText(
      'const [state, formAction, pending] = useActionState(greet, { message: "" })',
    );
    await expect(state).toContainText("<form action={formAction}>");
    await expect(state).toContainText("disabled={pending}");
    await expect(state).toContainText('aria-live="polite"');
    await expect(page.locator("article")).toContainText("Hello, Ada.");
    await followHeading(page, reader, "errors");
    const failure = page.locator("article pre code").filter({ hasText: 'name === "Admin"' });
    await expect(failure).toContainText('Effect.succeed({ message: "That name is reserved." })');
    await expect(failure).toContainText("Schema.NonEmptyString");
    await expect(page.locator("article")).toContainText("That name is reserved.");
  });

  test(`${reader.locale} reader sees typed caution callouts rather than literal alert markers`, async ({
    page,
  }) => {
    await page.goto(`/${reader.locale}/guide/components`);
    const warning = page.locator('article [data-alert="warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("props");
    await expect(warning).not.toContainText("[!WARNING]");
    await expect(warning).toHaveCSS("font-style", "normal");
    await expect(warning.locator(".docs-alert-title")).toHaveText("Warning");
    await expect(warning.locator("svg")).toBeVisible();
    const warningBorder = await warning.evaluate(
      (element) => getComputedStyle(element).borderInlineStartColor,
    );

    await page.goto(`/${reader.locale}/platforms/alchemy`);
    const important = page.locator('article [data-alert="important"]');
    await expect(important).toBeVisible();
    await expect(important).toContainText("2.0.0-beta.77");
    await expect(important).not.toContainText("[!IMPORTANT]");
    await expect(important.locator(".docs-alert-title")).toHaveText("Important");
    await expect(important.locator("svg")).toBeVisible();
    const importantBorder = await important.evaluate(
      (element) => getComputedStyle(element).borderInlineStartColor,
    );
    expect(importantBorder).not.toBe(warningBorder);
  });

  test(`${reader.locale} reader finds the create-and-run starter and its file roles`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/getting-started");
    await followHeading(page, reader, "setup");
    const commands = page.locator("article pre code").filter({ hasText: "vp create effront" });
    await expect(commands).toHaveText(
      "vp create effront -- my-app --platform node\ncd my-app\nvp install\nvp dev",
    );
    await expect(
      page.locator(
        'article a[href="https://github.com/totto2727-org/effront/blob/main/examples/node/src/entry.effront.tsx"]',
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
    const headingEdit = page.locator('article pre[data-language="tsx"] code');
    await expect(headingEdit).toContainText("const HomePage = EFFRONT.Page.make({");
    await expect(headingEdit).toContainText(
      "render: () => Effect.succeed(<h1>Hello, Effront</h1>),",
    );
    const tokenColors = await headingEdit
      .locator("span[style]")
      .evaluateAll((tokens) =>
        [
          ...new Set(
            tokens.map((token) => (token as HTMLElement).style.getPropertyValue("--shiki-dark")),
          ),
        ].filter(Boolean),
      );
    expect(tokenColors.length).toBeGreaterThan(2);
  });

  for (const [host, example] of [
    ["node", "node"],
    ["bun", "bun"],
    ["cloudflare", "cloudflare"],
    ["alchemy", "alchemy-cloudflare"],
  ] as const) {
    test(`${reader.locale} reader creates the ${host} starter without assembling host configuration`, async ({
      page,
    }) => {
      await page.goto(`/${reader.locale}/platforms`);
      await page.locator(`article a[href="/${reader.locale}/platforms/${host}"]`).click();
      await expect(page).toHaveURL(`/${reader.locale}/platforms/${host}`);
      await followHeading(page, reader, "setup");
      const commands = page.locator("article pre code").filter({ hasText: "vp create effront" });
      await expect(commands).toContainText(`vp create effront -- my-app --platform ${example}`);
      await expect(commands).toContainText("cd my-app");
      await expect(commands).toContainText("vp install");
      await expect(page.locator("article")).not.toContainText("git clone");
      await expect(page.locator("article")).not.toContainText("vp pack");
      await expect(page.locator("article")).not.toContainText("Count: 0");
      await expect(page.locator("article")).not.toContainText("cd examples/workers");
      if (host === "alchemy") {
        await expect(page.locator("article")).toContainText(
          reader.locale === "en"
            ? "local URL printed by Alchemy"
            : "Alchemy が表示するローカル URL",
        );
      } else {
        await expect(page.locator("article")).toContainText(
          reader.locale === "en" ? "local URL printed by Vite" : "Vite が表示するローカル URL",
        );
      }
      for (const file of ["src/entry.effront.tsx", "vite.config.ts", "package.json"]) {
        await expect(
          page.locator("article table").getByRole("row").filter({ hasText: file }),
        ).toBeVisible();
      }
      if (host === "cloudflare") {
        await followHeading(page, reader, "local");
        await expect(page.locator("article")).not.toContainText("vp preview");
        await expect(
          page.locator("article pre code").filter({ hasText: "vp exec wrangler dev" }),
        ).toHaveText(
          "vp build\nvp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787",
        );
        await expect(page.locator('article a[href="http://127.0.0.1:8787"]')).toBeVisible();
        await followHeading(page, reader, "context");
        const context = page.locator("article pre code").filter({ hasText: "readRequestSettings" });
        await expect(context).toContainText('from "@effront/cloudflare/workers"');
        await expect(context).toContainText("yield* getWorkersEnv<Env>()");
        await expect(context).toContainText("yield* getWorkersRequestContext<Env>()");
        await expect(context).toContainText("executionContext.waitUntil(recordAccess(path))");
        await expect(page.locator("article")).not.toContainText("My Effront App");
        const factory = page
          .locator("article pre code")
          .filter({ hasText: "createWorkersContextAccessors<Env>()" });
        await expect(factory).toContainText("const workers = createWorkersContextAccessors<Env>()");
        await expect(factory).toContainText("yield* workers.getWorkersEnv()");
        await expect(factory).toContainText("yield* workers.getWorkersRequestContext()");
        const colors = await factory
          .locator("span[style]")
          .evaluateAll((tokens) =>
            [
              ...new Set(
                tokens.map((token) =>
                  (token as HTMLElement).style.getPropertyValue("--shiki-dark"),
                ),
              ),
            ].filter(Boolean),
          );
        expect(colors.length).toBeGreaterThan(2);
      }
      if (host === "node" || host === "bun") {
        await expect(page.locator("article")).not.toContainText("vp preview");
        await expect(
          page.locator("article pre code").filter({ hasText: /^vp build$/ }),
        ).toBeVisible();
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
  });

  test(`${reader.locale} reader distinguishes default Tailwind setup from optional customization`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/styling");
    await followHeading(page, reader, "setup");
    const defaults = page
      .locator("article pre code")
      .filter({ hasText: "plugins: [effront(), effrontServer(), effrontTailwind()]" });
    await expect(defaults).toHaveCount(1);
    await expect(defaults).toContainText('from "@effront/tailwind"');
    await expect(defaults).toContainText(
      "plugins: [effront(), effrontServer(), effrontTailwind()]",
    );
    await expect(defaults).not.toContainText("stylesheet:");
    await expect(page.locator("article")).not.toContainText("stylingPlugins");
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
    const rendererExample = page
      .locator("article pre code")
      .filter({ hasText: "import { MarkdownDocument }" });
    await expect(rendererExample).toContainText('from "@effront/markdown/document"');
    await expect(rendererExample).toContainText('import "@effront/markdown/styles.css"');
    const collectionScope = page
      .locator('article [data-alert="note"]')
      .filter({ hasText: "TanStack Markdown" });
    await expect(collectionScope).toBeVisible();
    await expect(collectionScope.locator(".docs-alert-title")).toHaveText("Note");
    await expect(collectionScope).toContainText(
      reader.locale === "en"
        ? "Markdown files loaded at build time"
        : "ビルド時に読み込んだ Markdown ファイル",
    );
    await expect(collectionScope).toContainText(
      reader.locale === "en"
        ? "Markdown received from external sources at runtime"
        : "実行時に外部から受け取る Markdown",
    );
    await expect(collectionScope).toContainText(
      reader.locale === "en" ? "implement your own endpoint and rendering" : "独自のエンドポイント",
    );
    for (const href of ["https://comark.dev/", "https://tanstack.com/markdown/latest"]) {
      await expect(collectionScope.locator(`a[href="${href}"]`)).toBeVisible();
    }
    await followHeading(page, reader, "collection");
    const mappings = page
      .locator('article [data-alert="note"]')
      .filter({ hasText: "content/manual.md" });
    await expect(mappings).toBeVisible();
    await expect(mappings).toContainText(reader.locale === "en" ? "is omitted" : "省略され");
    await expect(mappings).toContainText(
      reader.locale === "en"
        ? "index.md is not treated specially"
        : "index.md は特別扱いされません",
    );
    await expect(mappings).toContainText("content/");
    await expect(mappings).toContainText("basePath");
    await expect(mappings).toContainText('"/"');
    await expect(mappings.locator("li")).toHaveText([
      "content/manual.md → /manual",
      "content/manual/index.md → /manual/index",
    ]);
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
    await expect(
      article.locator('[data-alert="warning"]').filter({ hasText: "sanitizer" }),
    ).toContainText(/not a sanitizer|sanitizer ではありません/);
    const rendering = article.locator("p").filter({ hasText: "@effront/markdown/document" });
    await expect(rendering).toContainText(
      /registers Comark's default Math\/Mermaid|Comark 標準の Math\/Mermaid/,
    );
    await expect(rendering).toContainText(
      /itself is not a Client Component|自体は Client Component ではありません/,
    );
    await expect(rendering).toContainText("@effront/markdown/styles.css");
    await expect(rendering).toContainText(
      /define prose, layout, alerts, and colors in the application|本文・レイアウト・alert・配色はアプリケーションで定義/,
    );
    await expect(rendering).toContainText(/SSR is not guaranteed|SSR を保証しません/);
    await expect(article.locator('a[href="https://comark.dev"]')).toBeVisible();
    await expect(article.locator('a[href="https://comark.dev/rendering/react"]')).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", reader.locale);
  });
}
