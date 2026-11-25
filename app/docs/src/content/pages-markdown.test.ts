import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { locales, matchingTerms } from "./pages-platform-fixtures.ts";
import { render, text, textOf } from "./pages-render.fixture.ts";

const renderReference = 'href="https://comark.dev/rendering/react"';
const guidePath = "/guide/markdown";
const apiPath = "/api-reference/markdown";
const collectionLinks = [
  'data-alert="note"',
  'href="https://comark.dev/"',
  'href="https://tanstack.com/markdown/latest"',
];
const collectionPaths = [
  "content/",
  "basePath",
  "content/manual.md → /manual",
  "content/manual/index.md → /manual/index",
];
const languageNotes = [
  {
    locale: "en",
    terms: [
      "Markdown files loaded at build time",
      "Markdown from external sources at runtime",
      "implement your own endpoint and renderer",
    ],
  },
  {
    locale: "ja",
    terms: [
      "ビルド時に読み込んだ Markdown ファイル",
      "実行時に外部から受け取る Markdown",
      "独自のエンドポイント",
    ],
  },
] as const;

describe("markdown collection and asset lookup", () => {
  test.each(languageNotes)(
    "explains build-time collection, runtime input and index paths in $locale",
    async ({ locale, terms }) => {
      const html = await render(`/${locale}${guidePath}`);
      const required = [...collectionPaths, ...terms];
      expect(matchingTerms(html, collectionLinks)).toStrictEqual(collectionLinks);
      expect(matchingTerms(textOf(html), required)).toStrictEqual(required);
    },
  );

  test.each(locales)("shows Markdown article lookup and asset usage in %s", async (locale) => {
    const guide = await text(`/${locale}${guidePath}`);
    const reference = await text(`/${locale}${apiPath}`);
    const assets = [
      "query: &quot;?url&quot;",
      "base: &quot;./content&quot;",
      "Tailwind Typography",
    ];
    const lookup = ["collection.get(&quot;/manual/start&quot;)", "undefined", "404"];
    expect(matchingTerms(guide, assets)).toStrictEqual(assets);
    expect(matchingTerms(reference, lookup)).toStrictEqual(lookup);
  });
});

const rendererNotes = [
  {
    defaultRegistration: "registers Math and Mermaid by default",
    locale: "en",
    placeholder: "only placeholders",
    replacement: "replacements that can render on the server",
  },
  {
    defaultRegistration: "標準で登録",
    locale: "ja",
    placeholder: "プレースホルダーのみ",
    replacement: "独自に実装",
  },
] as const;
const sharedRendererCases = Array.flatMap(rendererNotes, ({ locale, placeholder, replacement }) =>
  Array.map([guidePath, apiPath], (path) => ({
    path: `/${locale}${path}`,
    placeholder,
    replacement,
  })),
);
const rendererImports = [
  "@effront/markdown/document",
  "@effront/markdown/styles.css",
  "components",
];
const privateWiring =
  /use client|client leaf|RSC|internal wrapper|クライアント境界|document\.meta\.components|MarkdownDocumentProps|remote font|リモートフォント/u;
const codePattern = /<pre\b[^>]*>(?<code>[\s\S]*?)<\/pre>/gu;
const examples = [
  "import { MarkdownDocument } from &quot;@effront/markdown/document&quot;",
  "&lt;MarkdownDocument value={document} /&gt;",
  "function MyMermaid(props: ComponentProps&lt;typeof Mermaid&gt;)",
  "&lt;Mermaid {...props} width=&quot;100%&quot; /&gt;",
  "components={{ Mermaid: MyMermaid }}",
];
const preformatted = (html: string): string => {
  const blocks = Array.fromIterable(html.matchAll(codePattern));
  return Array.join(
    Array.map(blocks, ({ groups }) => textOf(groups?.["code"] ?? "")),
    "\n",
  );
};

describe("markdown renderer capabilities", () => {
  test.each(sharedRendererCases)(
    "explains the public renderer and server replacement behavior for $path",
    async ({ path, placeholder, replacement }) => {
      const html = await render(path);
      const prose = textOf(html);
      const required = [...rendererImports, placeholder, replacement];
      expect(prose).not.toMatch(privateWiring);
      expect(matchingTerms(prose, required)).toStrictEqual(required);
      expect(html).toContain(renderReference);
    },
  );

  test.each(rendererNotes)(
    "describes default Math and Mermaid registration in $locale",
    async ({ defaultRegistration, locale }) => {
      await expect(text(`/${locale}${guidePath}`)).resolves.toContain(defaultRegistration);
    },
  );

  test.each(locales)("renders the public Markdown component example in %s", async (locale) => {
    const html = await render(`/${locale}${apiPath}`);
    const code = preformatted(html);
    expect(matchingTerms(code, examples)).toStrictEqual(examples);
    expect(textOf(html)).toContain("nodejs_compat");
    expect(textOf(html)).not.toMatch(/node:path|node:url/u);
  });
});

const guideCaveats = [
  'href="/guide/getting-started#application"',
  'data-code-block=""',
  'tabindex="0"',
  "--shiki-dark",
  "createMarkdownCollection",
  "parseMarkdown",
  renderReference,
  'href="/api-reference/markdown#parse"',
  "MarkdownError",
];
const referenceCaveats = [
  "sanitizer",
  "Mermaid",
  "@effront/markdown/document",
  "@effront/markdown/mermaid",
];
const englishCaveats = [
  "preconfigured",
  "Math and Mermaid need client-side JavaScript.",
  "They do not render on the server.",
  "implement replacements that can render on the server",
];

describe("markdown caveats and server highlighting", () => {
  test("retains the guide links and scrollable highlighted code", async () => {
    const html = await render(guidePath);
    expect(matchingTerms(html, guideCaveats)).toStrictEqual(guideCaveats);
  });

  test("states the sanitization and Mermaid caveats in the reference", async () => {
    const reference = await render(apiPath);
    const prose = await text(`/en${apiPath}`);
    expect(matchingTerms(reference, referenceCaveats)).toStrictEqual(referenceCaveats);
    expect(matchingTerms(prose, englishCaveats)).toStrictEqual(englishCaveats);
    expect(prose).toMatch(/\bnot\b[^.]*\bsanitizer\b/iu);
  });
});
