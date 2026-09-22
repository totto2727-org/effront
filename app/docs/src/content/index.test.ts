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
  "/platforms/node",
  "/platforms/bun",
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

  it("keeps conceptual guides host-neutral and links the clone-and-run quickstart", async () => {
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
      "git clone https://github.com/totto2727-org/effront.git",
      "cd examples/hello-world",
      "vp install",
      "vp dev",
      "Hello, world",
      "src/entry.effront.tsx",
      "src/entry.rsc.ts",
      "src/entry.server.ts",
      "vite.config.ts",
      "package.json",
    ]) {
      expect(start).toContain(required);
    }
    expect(start).not.toContain("vp add");
    expect(await render("/guide/getting-started")).toContain(
      'href="https://github.com/totto2727-org/effront/tree/main/examples/hello-world"',
    );
    expect(await text("/best-practices/testing")).toContain("フォーム送信");
    const effect = await render("/guide/effect");
    for (const contract of ["Context.Service", "Layer", "Application.effront"]) {
      expect(effect.replace(/<[^>]*>/g, "")).toContain(contract);
    }
    expect(effect).toContain('href="https://effect.website/');
  });

  it.each(["en", "ja"] as const)(
    "uses Vite+ startup without dependency builds or preview detours in %s examples",
    async (locale) => {
      const directory = locale === "en" ? "en/articles" : "articles";
      for (const guide of [
        "guide/getting-started",
        "platforms/node",
        "platforms/bun",
        "platforms/cloudflare",
        "platforms/alchemy",
      ]) {
        const source = readFileSync(new URL(`./${directory}/${guide}.md`, import.meta.url), "utf8");
        expect(source).toContain("vp install");
        expect(source).toContain(guide === "platforms/alchemy" ? "vp run dev" : "vp dev");
        expect(source).not.toMatch(/vp pack|vp preview/);
      }
      const start = readFileSync(
        new URL(`./${directory}/guide/getting-started.md`, import.meta.url),
        "utf8",
      );
      expect([...start.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1])).toEqual([
        "git clone https://github.com/totto2727-org/effront.git\ncd effront\nvp install",
        "cd examples/hello-world\nvp dev",
      ]);
      expect(start).toContain("```tsx\nconst HomePage = EFFRONT.Page.make({");
      expect(start).toContain("render: () => Effect.succeed(<h1>Hello, Effront</h1>),");
      const html = await render(`/${locale}/guide/getting-started`);
      expect(html).toContain('data-language="tsx"');
      expect(html).toContain("--shiki-dark");
    },
  );

  it.each(["en", "ja"] as const)(
    "renders reader cautions through Comark's default alerts in %s",
    async (locale) => {
      for (const [slug, type] of [
        ["guide/components", "warning"],
        ["guide/routes", "warning"],
        ["platforms/cloudflare", "warning"],
        ["platforms/alchemy", "important"],
      ] as const) {
        const html = await render(`/${locale}/${slug}`);
        expect(html).toContain(`data-alert="${type}"`);
        expect(html).not.toContain(`[!${type.toUpperCase()}]`);
      }
    },
  );

  it.each(["hello-world", "node", "bun"])(
    "%s keeps development separate from preparation and uses its native production listener",
    (example) => {
      const manifest = JSON.parse(
        readFileSync(
          new URL(`../../../../examples/${example}/package.json`, import.meta.url),
          "utf8",
        ),
      ) as { scripts: Record<string, string> };
      expect(manifest.scripts).toEqual({
        dev: "vp dev",
        build: "vp build",
        start: `${example === "bun" ? "bun" : "node"} dist/rsc/server.js`,
      });
    },
  );

  it("describes implemented hosts and separates Bun production from Vite middleware", async () => {
    const platforms = await render("/platforms");
    for (const host of ["cloudflare", "alchemy", "node", "bun"]) {
      expect(platforms).toContain(`href="/platforms/${host}"`);
    }
    for (const adapter of ["@effront/cloudflare", "@effront/alchemy", "@effront/server"]) {
      expect(platforms).toContain(adapter);
    }
    for (const host of ["node", "bun"]) {
      const native = await text(`/platforms/${host}`);
      for (const required of [
        `${host} dist/rsc/server.js`,
        `@effront/server/${host}`,
        "effrontServer()",
        "dist/client/assets",
        "vp dev",
        "vp build",
        "vp run start",
      ]) {
        expect(native).toContain(required);
      }
      expect(await render(`/platforms/${host}`)).toContain('href="/api-reference/server"');
    }
    const bun = await text("/platforms/bun");
    for (const required of ["Bun 1.4.2", "@effect/platform-node", "@effect/platform-bun"]) {
      expect(bun).toContain(required);
    }
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

  it.each(["en", "ja"] as const)(
    "links runnable platform examples and their configured URLs in %s",
    async (locale) => {
      const repository = new URL("../../../../", import.meta.url);
      for (const [slug, example, port] of [
        ["node", "node", 1341],
        ["bun", "bun", 1342],
        ["cloudflare", "workers", 1343],
      ] as const) {
        const html = await render(`/${locale}/platforms/${slug}`);
        const prose = await text(`/${locale}/platforms/${slug}`);
        const config = readFileSync(
          new URL(`examples/${example}/vite.config.ts`, repository),
          "utf8",
        );
        expect(config).toContain(`server: { host: "127.0.0.1", port: ${port}, strictPort: true }`);
        expect(html).toContain(`href="http://127.0.0.1:${port}"`);
        expect(config).not.toContain("preview:");
        expect(prose).not.toContain("vp preview");
        if (slug === "cloudflare") {
          expect(prose).toContain(
            "vp build\nvp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787",
          );
          expect(html).toContain('href="http://127.0.0.1:8787"');
        }
        expect(html).toContain(
          `href="https://github.com/totto2727-org/effront/tree/main/examples/${example}"`,
        );
        for (const file of ["src/entry.effront.tsx", "vite.config.ts", "package.json"]) {
          expect(prose).toContain(file);
          expect(readFileSync(new URL(`examples/${example}/${file}`, repository), "utf8")).not.toBe(
            "",
          );
        }
        expect(prose).toContain(`cd examples/${example}`);
        expect(prose).toContain("vp install");
        expect(prose).not.toContain("vp pack");
        expect(prose).not.toContain("vp add");
      }
      const alchemy = await render(`/${locale}/platforms/alchemy`);
      expect(alchemy).toContain(
        'href="https://github.com/totto2727-org/effront/tree/main/examples/alchemy"',
      );
      expect(alchemy).toContain('href="http://localhost:1337"');
      expect(await text(`/${locale}/platforms/alchemy`)).toContain("Hello, world!");
      expect(
        readFileSync(new URL("examples/alchemy/src/entry.workers.ts", repository), "utf8"),
      ).toContain('dev: { host: "localhost", port: 1337, strictPort: true }');
      const chooser = await render(`/${locale}/platforms`);
      for (const id of ["setup", "entries", "assets", "node", "bun"]) {
        expect(chooser).toContain(`id="${id}"`);
      }
      expect(chooser).not.toContain("node-bun");
      expect(() => getPage(`/${locale}/platforms/node-bun`)).toThrow(
        "Documentation route is missing content",
      );
    },
  );

  it.each(["en", "ja"] as const)(
    "introduces Layout, Page, Routes, then the complete entry in %s",
    (locale) => {
      const directory = locale === "en" ? "en/articles" : "articles";
      const source = readFileSync(
        new URL(`./${directory}/guide/routes.md`, import.meta.url),
        "utf8",
      );
      const sections = source.split(/^## /m).slice(1);
      expect(sections.slice(0, 4).map((section) => section.match(/\{#([^}]+)\}/)?.[1])).toEqual([
        "layouts",
        "pages",
        "routes",
        "application",
      ]);
      const code = (section: string) => section.match(/```tsx\n([\s\S]*?)\n```/)?.[1] ?? "";
      expect(code(sections[0]!)).toContain("EFFRONT.Layout.make");
      expect(code(sections[0]!)).not.toContain("EFFRONT.Page.make");
      expect(code(sections[1]!)).toContain("EFFRONT.Page.make");
      expect(code(sections[1]!)).not.toContain("EFFRONT.Routes.make");
      expect(code(sections[2]!)).toContain(
        'Routes.make({ layout: RootLayout }).page("/", HomePage)',
      );
      expect(code(sections[3]!)).toContain("export default EFFRONT.make({ routes })");
      expect(source).toContain("http://127.0.0.1:1340/articles/hello");
    },
  );

  it.each(["en", "ja"] as const)(
    "gives executable guide steps the running sample's explicit origin in %s",
    async (locale) => {
      for (const [guide, path] of [
        ["getting-started", ""],
        ["routes", ""],
        ["components", ""],
        ["effect", ""],
        ["server-functions", ""],
        ["middleware", "/request"],
        ["markdown", "/manual/intro"],
        ["http", "/api/greeting"],
      ]) {
        expect(await render(`/${locale}/guide/${guide}`)).toContain(
          `href="http://127.0.0.1:1340${path}"`,
        );
      }
      const config = readFileSync(
        new URL("../../../../examples/hello-world/vite.config.ts", import.meta.url),
        "utf8",
      );
      expect(config).toContain('server: { host: "127.0.0.1", port: 1340, strictPort: true }');
    },
  );

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
