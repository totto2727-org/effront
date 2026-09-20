import { readFileSync, readdirSync } from "node:fs";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { getPage, localizedNavigation, localizedPages, navigation, pages } from "./index";
import { articleCatalog } from "./catalog";
import { englishArticleCatalog } from "./en/catalog";
import { documentLocale, documentPath, localizedPath } from "./locale";

const renderedPages = new Map<string, Promise<string>>();
function render(slug: string) {
  let html = renderedPages.get(slug);
  if (!html) {
    html = Effect.runPromise(getPage(slug).content()).then(renderToStaticMarkup);
    renderedPages.set(slug, html);
  }
  return html;
}
const text = async (slug: string) => (await render(slug)).replace(/<[^>]*>/g, "");

// These are published URLs, not a count that can silently hide a removed article.
const retainedUrls = [
  "/",
  "/guide/getting-started",
  "/guide/routes",
  "/guide/components",
  "/guide/effect",
  "/best-practices/testing",
  "/guide/server-functions",
  "/guide/middleware",
  "/guide/http",
  "/platforms",
  "/platforms/cloudflare",
  "/platforms/node-bun",
  "/platforms/alchemy",
  "/guide/markdown",
  "/guide/styling",
  "/api-reference/http",
  "/api-reference/server",
  "/api-reference/markdown",
  "/api-reference/alchemy",
  "/api-reference/tailwind",
  "/advanced",
  "/advanced/request-runtime-and-lifetimes",
  "/advanced/client-navigation",
  "/advanced/server-function-execution-and-refresh",
  "/api-reference",
  "/api-reference/application",
  "/api-reference/components",
  "/api-reference/routing",
  "/api-reference/server-functions",
  "/api-reference/workers",
  "/api-reference/vite",
  "/architecture/implementation/overview",
  "/architecture/implementation/application",
  "/architecture/implementation/routing",
  "/architecture/implementation/request",
  "/architecture/implementation/rendering",
  "/architecture/implementation/navigation",
  "/architecture/implementation/server-functions",
];

describe("documentation catalog", () => {
  it("preserves published URLs and unique serializable navigation metadata", () => {
    expect(pages.map((page) => page.slug).toSorted()).toEqual(retainedUrls.toSorted());
    expect(new Set(pages.map((page) => page.slug)).size).toBe(pages.length);
    expect(JSON.parse(JSON.stringify(navigation))).toEqual(navigation);
    expect([...new Set(pages.map((page) => page.section))]).toEqual([
      "Getting started",
      "Platforms",
      "Guides",
      "Best practices",
      "API reference",
      "アーキテクチャ",
    ]);
    for (const page of pages) {
      expect(page.slug).toMatch(/^\/(?:[a-z-]+(?:\/[a-z-]+)*)?$/);
      expect(getPage(page.slug)).toBe(page);
      expect(navigation.find((item) => item.slug === page.slug)).toEqual({
        slug: page.slug,
        title: page.title,
        section: page.section,
        ...(page.group ? { group: page.group } : {}),
      });
    }
  });

  it("removes the retired startup article from the catalog and navigation", () => {
    const retired = "/advanced/production-startup";
    expect(pages.map((page) => page.slug)).not.toContain(retired);
    expect(navigation.map((page) => page.slug)).not.toContain(retired);
    expect(() => getPage(retired)).toThrow("Documentation route is missing content");
  });

  it("separates testing best practices from feature guides without duplicating the article", () => {
    expect(
      pages.filter((page) => page.section === "Best practices").map((page) => page.slug),
    ).toEqual(["/best-practices/testing"]);
    expect(
      getPage("/best-practices/testing")
        .headings.map((heading) => heading.id)
        .toSorted(),
    ).toEqual(["pages", "production", "services", "tools"]);
    expect(navigation.map((page) => page.slug)).not.toContain("/guide/testing");
    expect(() => getPage("/guide/testing")).toThrow("Documentation route is missing content");
  });

  it("keeps every Markdown document registered, including the explicit root alias", () => {
    const sources = Object.keys(import.meta.glob("./articles/**/*.md"));
    expect(articleCatalog.map((page) => `./articles${page.source}.md`).toSorted()).toEqual(
      sources.toSorted(),
    );
    expect(articleCatalog.find((page) => page.slug === "/")?.source).toBe("/index");
    expect(() => getPage("/index")).toThrow("Documentation route is missing content");
    const englishSources = Object.keys(import.meta.glob("./en/articles/**/*.md"));
    expect(
      englishArticleCatalog.map((page) => `./en/articles${page.source}.md`).toSorted(),
    ).toEqual(englishSources.toSorted());
    expect(englishArticleCatalog.map((page) => page.slug).toSorted()).toEqual(
      articleCatalog.map((page) => page.slug).toSorted(),
    );
    expect(englishArticleCatalog.find((page) => page.slug === "/")?.source).toBe("/index");
    for (const locale of ["ja", "en"] as const) {
      expect(() => getPage(`/${locale}/index`)).toThrow("Documentation route is missing content");
    }
  });

  it.each(["ja", "en"] as const)(
    "registers every published page and serializable navigation item in %s",
    (locale) => {
      const items = localizedNavigation(locale);
      const expectedSlugs = retainedUrls.map((slug) => localizedPath(slug, locale));
      expect(items.map((item) => item.slug).toSorted()).toEqual(expectedSlugs.toSorted());
      expect(JSON.parse(JSON.stringify(items))).toEqual(items);
      for (const item of items) {
        const { slug, title, section, group } = getPage(item.slug);
        expect(item).toEqual({ slug, title, section, ...(group ? { group } : {}) });
        expect(title.trim()).not.toBe("");
        expect(section.trim()).not.toBe("");
        expect(getPage(item.slug).description.trim()).not.toBe("");
      }
      expect(
        items.filter((item) => documentPath(item.slug).startsWith("/architecture/implementation/")),
      ).toHaveLength(7);
      for (const retired of ["/advanced/production-startup", "/guide/testing"]) {
        expect(() => getPage(localizedPath(retired, locale))).toThrow(
          "Documentation route is missing content",
        );
      }
    },
  );

  it("keeps localized pages unique and distinct from the legacy Japanese aliases", () => {
    expect(localizedPages).toHaveLength(retainedUrls.length * 2);
    const allPages = [...pages, ...localizedPages];
    expect(new Set(allPages.map((page) => page.slug)).size).toBe(allPages.length);
    for (const page of localizedPages) {
      expect(page.slug).toMatch(/^\/(en|ja)(?:\/[a-z-]+)*$/);
      expect(getPage(page.slug)).toBe(page);
    }
  });

  it("keeps conceptual guides host-neutral and provides a complete selectable quickstart", async () => {
    for (const slug of [
      "/guide/routes",
      "/guide/components",
      "/guide/effect",
      "/guide/server-functions",
      "/guide/middleware",
      "/guide/http",
      "/best-practices/testing",
    ]) {
      expect(await text(slug)).not.toMatch(/Cloudflare|Workers|Wrangler|workerd|Vercel/);
    }
    const start = await text("/guide/getting-started");
    for (const required of [
      "vp add @effront/core@0.1.4",
      "effect@4.0.0-rc.112",
      "Application.effront()",
      "EFFRONT.Page.make",
      "EFFRONT.Layout.make",
      "EFFRONT.Routes.make",
      "Hello, Effront",
    ]) {
      expect(start).toContain(required);
    }
    expect(start).not.toMatch(/vp install|チェックアウト|workspace依存/);
    const startHtml = await render("/guide/getting-started");
    for (const host of ["cloudflare", "node-bun", "alchemy"]) {
      expect(startHtml).toContain(`href="/platforms/${host}#setup"`);
    }
    expect(start).not.toContain("wrangler.json");
    expect(await text("/best-practices/testing")).toContain("フォーム送信");
    const effect = await render("/guide/effect");
    for (const contract of ["Context.Service", "Layer", "Application.effront"]) {
      expect(effect.replace(/<[^>]*>/g, "")).toContain(contract);
    }
    expect(effect).toContain('href="https://effect.website/');
  });

  it("describes implemented hosts and separates Bun production from Vite middleware", async () => {
    const platforms = await render("/platforms");
    for (const host of ["cloudflare", "alchemy", "node-bun"]) {
      expect(platforms).toContain(`href="/platforms/${host}"`);
    }
    for (const adapter of ["@effront/cloudflare", "@effront/alchemy", "@effront/server"]) {
      expect(platforms).toContain(adapter);
    }
    const native = await text("/platforms/node-bun");
    for (const required of [
      "node dist/rsc/server.js",
      "bun dist/rsc/server.js",
      "Bun 1.4.2",
      "@effect/platform-node",
      "@effect/platform-bun",
      "effrontServer()",
      "Layer.launch",
      "dist/client/assets",
      "vp dev",
    ]) {
      expect(native).toContain(required);
    }
    expect(await render("/platforms/node-bun")).toContain(
      'href="/best-practices/testing#production"',
    );
    const testing = await render("/best-practices/testing");
    expect(testing).toContain('href="https://playwright.dev/docs/test-webserver"');
    expect(testing).toContain('href="/guide/server-functions"');
    expect(testing).toContain("JavaScript");
    const alchemy = await render("/platforms/alchemy");
    expect(alchemy).toContain("profile");
    expect(alchemy).toContain('href="https://alchemy.run/');
    const lifetime = await text("/advanced/request-runtime-and-lifetimes");
    for (const contract of [
      "Effect.acquireRelease",
      "createFetchHandler",
      "Effect.scoped",
      "makeHttpEffect",
    ]) {
      expect(lifetime).toContain(contract);
    }
  });

  it.each(["/api-reference", "/ja/api-reference", "/en/api-reference"])(
    "%s indexes every public package export and the manifest release version",
    async (slug) => {
      const html = await render(slug);
      const root = new URL("../../../../packages/", import.meta.url);
      for (const name of readdirSync(root)) {
        const manifest = JSON.parse(
          readFileSync(new URL(`${name}/package.json`, root), "utf8"),
        ) as {
          name: string;
          version: string;
          exports: Record<string, unknown>;
        };
        expect(html).toContain(manifest.version);
        for (const subpath of Object.keys(manifest.exports).filter(
          (path) => !path.includes("/internal/"),
        )) {
          expect(html).toContain(
            subpath === "." ? manifest.name : `${manifest.name}${subpath.slice(1)}`,
          );
        }
      }
    },
  );

  it("keeps Markdown caveats and server-only highlighting visible", async () => {
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
    expect(reference).toContain("SSR");
    expect(html).toContain("MarkdownError");
    const englishReference = await text("/en/api-reference/markdown");
    expect(englishReference).toMatch(/\bnot\b[^.]*\bsanitizer\b/i);
    expect(englishReference).toMatch(
      /does not automatically register Math\/Mermaid React components/i,
    );
    expect(englishReference).toMatch(/does not establish full SSR rendering/i);
  });

  it("retains all seven authored architecture chapters under their implementation group", () => {
    const architecture = pages.filter((page) => page.section === "アーキテクチャ");
    expect(architecture).toHaveLength(7);
    for (const page of architecture) {
      expect(page.group).toBe("実装解説");
      expect(page.slug).toMatch(/^\/architecture\/implementation\//);
    }
    expect(pages.some((page) => page.slug.startsWith("/reading/"))).toBe(false);
  });

  it.each(
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
        caption?.replace(/<[^>]*>/g, "").trim(),
      );
    }
  });

  it("rejects missing content instead of silently rendering another page", () => {
    for (const slug of [
      "/not-a-document",
      "/en/not-a-document",
      "/ja/not-a-document",
      "/fr/guide/routes",
    ]) {
      expect(() => getPage(slug)).toThrow(`Documentation route is missing content: ${slug}`);
    }
  });

  it.each([...pages, ...localizedPages])(
    "$slug renders every table-of-contents target and valid internal links",
    async (page) => {
      const html = await render(page.slug);
      expect(page.headings.length).toBeGreaterThan(0);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(ids).size).toBe(ids.length);
      const headingIds = [...html.matchAll(/<h[2-6]\b[^>]*\bid="([^"]+)"/g)].map(
        (match) => match[1],
      );
      expect(headingIds).toEqual(page.headings.map((heading) => heading.id));
      for (const heading of page.headings) {
        expect(heading.id).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(ids).toContain(heading.id);
      }
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
        const url = new URL(href, `https://docs.example${page.slug}`);
        const target = getPage(url.pathname);
        if (/^\/(en|ja)(?:\/|$)/.test(page.slug)) {
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
