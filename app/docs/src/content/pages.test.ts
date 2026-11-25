import { access, readFile, readdir } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { getPage, localizedPages, pages } from "./pages.ts";
import { documentLocale, localizedPath } from "./locale.ts";

import { render, text } from "./pages-render.fixture.ts";

describe("documentation catalog", () => {
  test.each(["en", "ja"])(
    "%s explains the selected Markdown collection and ordinary index paths",
    async (locale) => {
      const html = await render(`/${locale}/guide/markdown`);
      const prose = await text(`/${locale}/guide/markdown`);
      expect(html).toContain('data-alert="note"');
      expect(html).toContain('href="https://comark.dev/"');
      expect(html).toContain('href="https://tanstack.com/markdown/latest"');
      expect(prose).toContain(
        locale === "en"
          ? "Markdown files loaded at build time"
          : "ビルド時に読み込んだ Markdown ファイル",
      );
      expect(prose).toContain(
        locale === "en"
          ? "Markdown from external sources at runtime"
          : "実行時に外部から受け取る Markdown",
      );
      expect(prose).toContain(
        locale === "en" ? "implement your own endpoint and renderer" : "独自のエンドポイント",
      );
      expect(prose).toContain("content/");
      expect(prose).toContain("basePath");
      expect(prose).toContain("content/manual.md → /manual");
      expect(prose).toContain("content/manual/index.md → /manual/index");
    },
  );

  test.each([
    "README.md",
    "docs/INDEX.md",
    "examples/AGENTS.md",
    "app/docs/docs/AUTHORING.md",
    "packages/markdown/README.md",
    "packages/markdown/AGENTS.md",
    "packages/markdown/docs/IMPLEMENTATION.md",
  ])("%s links Markdown readers to maintained documentation", async (path) => {
    const repository = new URL("../../../../", import.meta.url);
    const file = new URL(path, repository);
    const source = await readFile(file, "utf8");
    expect(source).not.toContain("markdown/docs/GUIDE.md");
    if (path.startsWith("packages/markdown/")) {
      expect(source).not.toMatch(/\]\((?:\.\/)?(?:docs\/)?GUIDE\.md(?:[#)]|$)/u);
    }
    const links = [...source.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]!);
    for (const href of links) {
      if (href.includes("effront.totto2727.dev")) {
        const target = new URL(href);
        expect(target.origin).toBe("https://effront.totto2727.dev");
        expect(localizedPages.map((page) => page.slug)).toContain(target.pathname);
      } else if (href.includes("markdown") && !/^[a-z]+:|^#/u.test(href)) {
        await expect(
          access(new URL(href.split("#")[0] ?? "", file)),
          href,
        ).resolves.toBeUndefined();
      }
    }
  });

  test("keeps the Markdown README as a canonical documentation entry point", async () => {
    const repository = new URL("../../../../", import.meta.url);
    const source = await readFile(new URL("packages/markdown/README.md", repository), "utf8");
    ["guide", "api-reference"].forEach((section) => {
      expect(source).toContain(`https://effront.totto2727.dev/en/${section}/markdown`);
    });
    await expect(
      access(new URL("packages/markdown/docs/GUIDE.md", repository)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  test.each(["en", "ja"])("%s explains Markdown article lookup and asset usage", async (locale) => {
    const guide = await text(`/${locale}/guide/markdown`);
    expect(guide).toContain("query: &quot;?url&quot;");
    expect(guide).toContain("base: &quot;./content&quot;");
    expect(guide).toContain("Tailwind Typography");
    const reference = await text(`/${locale}/api-reference/markdown`);
    ["collection.get(&quot;/manual/start&quot;)", "undefined", "404"].forEach((contract) => {
      expect(reference).toContain(contract);
    });
  });

  test.each(
    ["en", "ja"].flatMap((locale) => [
      `/${locale}/guide/markdown`,
      `/${locale}/api-reference/markdown`,
    ]),
  )("%s explains renderer capabilities without internal wiring", async (slug) => {
    const prose = await text(slug);
    expect(prose).not.toMatch(/use client|client leaf|RSC|internal wrapper|クライアント境界/u);
    expect(prose).not.toMatch(
      /document\.meta\.components|MarkdownDocumentProps|remote font|リモートフォント/u,
    );
    ["@effront/markdown/document", "@effront/markdown/styles.css", "components"].forEach(
      (contract) => {
        expect(prose).toContain(contract);
      },
    );
    if (slug.includes("/api-reference/")) {
      const html = await render(slug);
      const code = [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)]
        .map(([, block]) => block?.replaceAll(/<[^>]*>/g, ""))
        .join("\n");
      expect(code).toContain(
        "import { MarkdownDocument } from &quot;@effront/markdown/document&quot;",
      );
      expect(code).toContain("&lt;MarkdownDocument value={document} /&gt;");
      expect(code).toContain("function MyMermaid(props: ComponentProps&lt;typeof Mermaid&gt;)");
      expect(code).toContain("&lt;Mermaid {...props} width=&quot;100%&quot; /&gt;");
      expect(code).toContain("components={{ Mermaid: MyMermaid }}");
      expect(prose).toContain("nodejs_compat");
      expect(prose).not.toMatch(/node:path|node:url/u);
    } else {
      expect(prose).toContain(
        slug.startsWith("/en") ? "registers Math and Mermaid by default" : "標準で登録",
      );
    }
    expect(prose).toContain(slug.startsWith("/en") ? "only placeholders" : "プレースホルダーのみ");
    expect(prose).toContain(
      slug.startsWith("/en") ? "replacements that can render on the server" : "独自に実装",
    );
    await expect(render(slug)).resolves.toContain('href="https://comark.dev/rendering/react"');
  });

  test("keeps Markdown caveats and server-only highlighting visible", async () => {
    const html = await render("/guide/markdown");
    expect(html).toContain('href="/guide/getting-started#application"');
    expect(html).toContain('data-code-block=""');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("--shiki-dark");
    expect(html).toContain("createMarkdownCollection");
    expect(html).toContain("parseMarkdown");
    expect(html).toContain('href="https://comark.dev/rendering/react"');
    expect(html).toContain('href="/api-reference/markdown#parse"');
    const reference = await render("/api-reference/markdown");
    expect(reference).toContain("sanitizer");
    expect(reference).toContain("Mermaid");
    expect(reference).toContain("@effront/markdown/document");
    expect(reference).toContain("@effront/markdown/mermaid");
    expect(html).toContain("MarkdownError");
    const englishReference = await text("/en/api-reference/markdown");
    expect(englishReference).toMatch(/\bnot\b[^.]*\bsanitizer\b/i);
    expect(englishReference).toContain("preconfigured");
    expect(englishReference).toContain("Math and Mermaid need client-side JavaScript.");
    expect(englishReference).toContain("They do not render on the server.");
    expect(englishReference).toContain("implement replacements that can render on the server");
  });

  test("retains all seven authored architecture chapters under their implementation group", async () => {
    const architecture = pages.filter((page) => page.section === "アーキテクチャ");
    expect(architecture).toHaveLength(7);
    for (const page of architecture) {
      expect(page.group).toBe("実装解説");
      expect(page.slug).toMatch(/^\/architecture\/implementation\//u);
    }
    expect(pages.some((page) => page.slug.startsWith("/reading/"))).toBe(false);
    for (const locale of ["en", "ja"] as const) {
      await expect(text(`/${locale}`)).resolves.toContain(
        locale === "en"
          ? "For advanced consumers and Effront developers"
          : "高度な使い方をする利用者や Effront の開発者",
      );
    }
  });

  test.each(
    localizedPages.filter((page) => page.slug.startsWith("/en/architecture/implementation/")),
  )("$slug labels every source excerpt in English", async (page) => {
    const html = await render(page.slug);
    const excerpts = [
      ...html.matchAll(/<figure\b[^>]*data-core-source="([^"]+)"[^>]*>([\s\S]*?)<\/figure>/g),
    ];
    expect(excerpts.length).toBeGreaterThan(0);
    for (const [, path, figure] of excerpts) {
      const caption = figure?.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/)?.[1];
      expect([`Excerpt from ${path}`, `${path} excerpt`]).toContain(
        caption?.replaceAll(/<[^>]*>/g, "").trim(),
      );
    }
  });

  test("rejects missing content instead of silently rendering another page", () => {
    ["/not-a-document", "/en/not-a-document", "/ja/not-a-document", "/fr/guide/routes"].forEach(
      (slug) => {
        expect(() => getPage(slug)).toThrow(`Documentation route is missing content: ${slug}`);
      },
    );
  });

  test.each([...pages, ...localizedPages])(
    "$slug renders every table-of-contents target and valid internal links",
    async (page) => {
      const html = await render(page.slug);
      expect(page.headings.length).toBeGreaterThan(0);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(ids).size).toBe(ids.length);
      const headingIds = [...html.matchAll(/<h[2-6]\b[^>]*\bid="([^"]+)"/g)].map(
        (match) => match[1],
      );
      expect(headingIds).toStrictEqual(page.headings.map((heading) => heading.id));
      for (const heading of page.headings) {
        expect(heading.id).toMatch(/^[a-z][a-z0-9-]*$/u);
        expect(ids).toContain(heading.id);
      }
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
          continue;
        }
        const url = new URL(href, `https://docs.example${page.slug}`);
        const target = getPage(url.pathname);
        if (/^\/(en|ja)(?:\/|$)/u.test(page.slug)) {
          expect(target.slug, `${page.slug} -> ${href}`).toBe(
            localizedPath(target.slug, documentLocale(page.slug)),
          );
        }
        if (url.hash) {
          const targetHtml = url.pathname === page.slug ? html : await render(target.slug);
          expect(targetHtml, `${page.slug} -> ${href}`).toContain(
            `id="${decodeURIComponent(url.hash.slice(1))}"`,
          );
        }
      }
    },
  );
});
