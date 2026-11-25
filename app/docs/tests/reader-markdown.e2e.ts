import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { Reader } from "./reader-journey.browser.fixture.ts";
import { followHeading, openGuide, readers } from "./reader-journey.browser.fixture.ts";

const noMatchingNotes = 0;
const collectionNote = 'article [data-alert="note"]';

const expectRendererExample = async (page: Page, reader: Reader): Promise<void> => {
  const renderer = page
    .locator("article pre code")
    .filter({ hasText: "import { MarkdownDocument }" });
  await expect(renderer).toContainText('from "@effront/markdown/document"');
  await expect(renderer).toContainText('import "@effront/markdown/styles.css"');
  const article = page.locator("article");
  await expect(article).toContainText(
    reader.locale === "en"
      ? "Effront does not supply Markdown body styles."
      : "Markdown 本文のスタイリングは提供しません。",
  );
  await expect(article).toContainText("Tailwind Typography");
};

const expectCollectionScope = async (page: Page, reader: Reader, scope: Locator): Promise<void> => {
  await expect(scope).toBeVisible();
  if (reader.locale === "en") {
    await expect(
      page.locator("article p").filter({ hasText: "Markdown files loaded at build time" }),
    ).toBeVisible();
    await expect(page.locator(collectionNote).filter({ hasText: "TanStack Markdown" })).toHaveCount(
      noMatchingNotes,
    );
  } else {
    await expect(scope.locator(".docs-alert-title")).toHaveText("Note");
  }
};

const expectCollectionIntroduction = async (page: Page, reader: Reader): Promise<void> => {
  const scope =
    reader.locale === "en"
      ? page.locator("article")
      : page.locator(collectionNote).filter({ hasText: "TanStack Markdown" });
  await expectCollectionScope(page, reader, scope);
  await expect(scope).toContainText(
    reader.locale === "en"
      ? "Markdown files loaded at build time"
      : "ビルド時に読み込んだ Markdown ファイル",
  );
  await expect(scope).toContainText(
    reader.locale === "en"
      ? "Markdown from external sources at runtime"
      : "実行時に外部から受け取る Markdown",
  );
  await expect(scope).toContainText(
    reader.locale === "en" ? "implement your own endpoint and renderer" : "独自のエンドポイント",
  );
  await Promise.all(
    ["https://comark.dev/", "https://tanstack.com/markdown/latest"].map(async (href) =>
      expect(scope.locator(`a[href="${href}"]`)).toBeVisible(),
    ),
  );
};

const expectCollectionMapping = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "collection");
  const mappings = page.locator(collectionNote).filter({ hasText: "content/manual.md" });
  await expect(mappings).toBeVisible();
  await expect(mappings).toContainText(
    reader.locale === "en" ? "omits the file extension" : "省略され",
  );
  await expect(mappings).toContainText(
    reader.locale === "en"
      ? "does not give index.md special treatment"
      : "index.md は特別扱いされません",
  );
  await expect(mappings).toContainText("content/");
  await expect(mappings).toContainText("basePath");
  await expect(mappings).toContainText('"/"');
  await expect(mappings.locator("li")).toHaveText([
    "content/manual.md → /manual",
    "content/manual/index.md → /manual/index",
  ]);
};

const openMarkdownReference = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "authoring");
  const article = page.locator("article");
  await expect(article.locator("code").filter({ hasText: "linkify: false" })).toBeVisible();
  const extension = article.locator("pre code").filter({ hasText: "plugins: [toc()]" });
  await expect(extension).toContainText('import toc from "comark/plugins/toc"');
  await expect(extension).toContainText("parseMarkdown(entry,");
  const path = `/${reader.locale}/api-reference/markdown#parse`;
  await article.locator(`a[href="${path}"]`).click();
  await expect(page).toHaveURL(path);
  await expect(page.locator("article h2#parse")).toHaveText("parseMarkdown");
};

const expectParserOptions = async (page: Page): Promise<void> => {
  await expect(page.locator("article h2#parse")).toBeInViewport();
  const article = page.locator("article");
  await Promise.all(
    ["footnotes()", "math()", "mermaid({", "shiki()"].map(async (plugin) =>
      expect(article.getByRole("row").filter({ hasText: plugin })).toBeVisible(),
    ),
  );
  await expect(article.locator("code").filter({ hasText: /^ParserOptions$/u })).toBeVisible();
  const options = article.locator("p").filter({ hasText: "options.plugins" });
  await expect(options).toContainText(/after these four plugins|後に追加/u);
  await expect(options).toContainText(/not instead of them|置き換えにはなりません/u);
  await expect(article).toContainText(/No option removes|削除するオプションはありません/u);
  await expect(
    article.locator("code").filter({ hasText: "registerDefaultPlugins: false" }),
  ).toBeVisible();
  await expect(
    article.locator('[data-alert="warning"]').filter({ hasText: "sanitizer" }),
  ).toContainText(/not a sanitizer|sanitizer ではありません/u);
};

const expectCustomMermaid = async (article: Locator): Promise<void> => {
  const customization = article.locator("pre code").filter({ hasText: "function MyMermaid" });
  await expect(customization).toContainText('from "@effront/markdown/mermaid"');
  await expect(customization).toContainText('width="100%"');
  await expect(customization).toContainText("components={{ Mermaid: MyMermaid }}");
};

const expectRenderingRegistration = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "rendering");
  const article = page.locator("article");
  const rendering = article.locator("p").filter({ hasText: "@effront/markdown/document" });
  await expect(rendering).toContainText("@effront/markdown/styles.css");
  const example = article
    .locator("pre code")
    .filter({ hasText: 'import "@effront/markdown/styles.css"' });
  await expect(example).toContainText('from "@effront/markdown/document"');
  await expect(example).toContainText("<MarkdownDocument value={document} />");
  await expectCustomMermaid(article);
};

const expectRenderingLimits = async (page: Page, reader: Reader): Promise<void> => {
  const article = page.locator("article");
  const warning = article.locator('[data-alert="warning"]').filter({ hasText: "SSR" });
  await expect(warning).toContainText(
    /need client-side JavaScript|クライアント JavaScript が必須/u,
  );
  await expect(warning).toContainText(/server skips rendering|レンダリングをスキップ/u);
  await expect(warning).toContainText(
    /implement replacements that can render on the server|コンポーネントを独自に実装/u,
  );
  await expect(article.locator('a[href="https://comark.dev"]')).toBeVisible();
  await expect(article.locator('a[href="https://comark.dev/rendering/react"]')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", reader.locale);
};

readers.forEach((reader) => {
  test(`${reader.locale} reader follows Markdown configuration to defaults, extensions and safety limits`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/markdown");
    await expectRendererExample(page, reader);
    await expectCollectionIntroduction(page, reader);
    await expectCollectionMapping(page, reader);
    await openMarkdownReference(page, reader);
    await expectParserOptions(page);
    await expectRenderingRegistration(page, reader);
    await expectRenderingLimits(page, reader);
  });
});
