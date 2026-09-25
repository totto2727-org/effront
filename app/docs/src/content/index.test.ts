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
  "/best-practices/authentication-and-authorization",
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
  it.each(["en", "ja"] as const)(
    "lists client navigation directly under Guides with its published URL and anchors in %s",
    (locale) => {
      const slug = `/${locale}/advanced/client-navigation`;
      const page = getPage(slug);
      expect(page.section).toBe("Guides");
      expect(page.group).toBeUndefined();
      expect(localizedNavigation(locale).find((item) => item.slug === slug)).toEqual({
        slug,
        title: page.title,
        section: "Guides",
      });
      expect(page.headings.map((heading) => heading.id)).toEqual([
        "native-navigation",
        "transition-scope",
        "global-config",
        "commit-and-stream",
        "history-cache",
      ]);
    },
  );

  it.each(["en", "ja"] as const)(
    "renders concise Page and application examples with notes and reference links in %s",
    async (locale) => {
      const slug = `/${locale}/advanced/client-navigation`;
      const html = await render(slug);
      const content = await text(slug);
      for (const example of [
        "viewTransition: false",
        "layer: Layer.succeed(PageViewTransition, { enabled: false })",
        "viewTransition: { enabled: true }",
      ]) {
        expect(content).toContain(example);
      }
      expect(html.match(/data-alert="note"/g)).toHaveLength(3);
      expect(content).not.toContain("[!NOTE]");
      expect(html).toContain(`href="/${locale}/api-reference/components#view-transition"`);
      for (const referenceOnly of [
        "data-effront-transition-types",
        "hmr-refresh",
        "navigation-ua-visual-transition",
        "photo-fade",
      ]) {
        expect(content).not.toContain(referenceOnly);
        expect(await text(`/${locale}/api-reference/components`)).toContain(referenceOnly);
      }
      expect(content).not.toMatch(/transition boundary|遷移境界|NavigationPrecommitController/);
    },
  );

  it("keeps client navigation code examples identical in English and Japanese", () => {
    const examples = (directory: string) => {
      const source = readFileSync(
        new URL(`./${directory}/advanced/client-navigation.md`, import.meta.url),
        "utf8",
      );
      return [...source.matchAll(/```tsx\n([\s\S]*?)\n```/g)].map((match) => match[1]);
    };
    expect(examples("en/articles")).toHaveLength(4);
    expect(examples("articles")).toEqual(examples("en/articles"));
  });

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

  it.each(["en", "ja"] as const)(
    "classifies final guides and best practices without a runtime overview or subgroup in %s",
    async (locale) => {
      const items = localizedNavigation(locale);
      expect(
        items
          .filter((item) => item.section === "Best practices")
          .map((item) => documentPath(item.slug)),
      ).toEqual([
        "/best-practices/authentication-and-authorization",
        "/advanced/request-runtime-and-lifetimes",
        "/best-practices/testing",
      ]);
      for (const item of items.filter((item) =>
        ["Guides", "Best practices"].includes(item.section),
      )) {
        expect(item.group).toBeUndefined();
      }
      const expectedHeadings = [
        [
          "/best-practices/authentication-and-authorization",
          ["entry-points", "shared-policy", "authorization"],
        ],
        [
          "/advanced/request-runtime-and-lifetimes",
          ["resource-design", "request-layer", "response-lifetime"],
        ],
        ["/best-practices/testing", ["tools", "routes", "pages", "layouts", "server-functions"]],
        [
          "/advanced/server-function-execution-and-refresh",
          ["execution", "result-and-refresh", "concurrency"],
        ],
        ["/api-reference/server-functions", ["make", "arguments", "execution", "request-protocol"]],
      ] as const;
      for (const [slug, ids] of expectedHeadings) {
        const page = getPage(localizedPath(slug, locale));
        expect(page.headings.map((heading) => heading.id)).toEqual(ids);
        const directory = locale === "en" ? "en/articles" : "articles";
        const source = readFileSync(new URL(`./${directory}${slug}.md`, import.meta.url), "utf8");
        expect(page.headings).toEqual(
          [...source.matchAll(/^#{2,6} (.*?) \{#([^}]+)\}$/gm)].map((match) => ({
            id: match[2],
            title: match[1]?.replace(/`/g, ""),
          })),
        );
      }
      expect(getPage(`/${locale}/best-practices/authentication-and-authorization`).title).toBe(
        locale === "en" ? "Authentication and authorization" : "認証と認可",
      );
      expect(getPage(`/${locale}/advanced/request-runtime-and-lifetimes`).title).toBe(
        locale === "en" ? "Manage service lifetimes" : "サービスの生存期間を管理する",
      );
      expect(getPage(`/${locale}/advanced/server-function-execution-and-refresh`).section).toBe(
        "Guides",
      );
      for (const [slug, ids] of [
        ["/best-practices/testing", ["services", "production"]],
        ["/advanced/request-runtime-and-lifetimes", ["render-scope"]],
        ["/advanced/server-function-execution-and-refresh", ["input-boundary"]],
      ] as const) {
        const html = await render(localizedPath(slug, locale));
        for (const id of ids) expect(html).toContain(`id="${id}"`);
      }
      for (const retired of ["/advanced", "/guide/testing"]) {
        expect(items.map((item) => item.slug)).not.toContain(localizedPath(retired, locale));
        expect(() => getPage(localizedPath(retired, locale))).toThrow(
          "Documentation route is missing content",
        );
        expect(() => getPage(retired)).toThrow("Documentation route is missing content");
      }
    },
  );

  it.each(["en", "ja"] as const)(
    "documents runnable Route, Page, Layout and Server Function checks against the example in %s",
    async (locale) => {
      const html = await render(`/${locale}/best-practices/testing`);
      const content = (await text(`/${locale}/best-practices/testing`)).replaceAll("&quot;", '"');
      for (const contract of [
        "@playwright/test",
        'request.get("/not-a-route")',
        "missing.status()).toBe(404)",
        'name: "Count: 1"',
        "element.isConnected",
        'getByTestId("action-greeting")',
        "Hello from Alchemy KV, Ada!",
        "TypeError",
      ])
        expect(content).toContain(contract);
      for (const path of [
        "tree/main/examples/basic",
        "tree/main/tests/e2e-alchemy",
        "blob/main/tests/e2e-alchemy/playwright.config.ts",
        "blob/main/docs/TESTING.md#native-alchemy-integration",
      ])
        expect(html).toContain(`href="https://github.com/totto2727-org/effront/${path}"`);
      expect(content).toContain(
        locale === "en"
          ? "does not provide a public Vitest harness"
          : "公開テストハーネスを提供していません",
      );
      expect(content).toContain(
        locale === "en" ? "without Cloudflare authentication" : "Cloudflare の認証なし",
      );
    },
  );

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
      for (const retired of ["/advanced", "/advanced/production-startup", "/guide/testing"]) {
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

  it("keeps conceptual guides host-neutral and links the create-and-run quickstart", async () => {
    for (const slug of [
      "/guide/routes",
      "/guide/components",
      "/guide/effect",
      "/guide/server-functions",
      "/guide/middleware",
      "/guide/http",
    ]) {
      expect(await text(slug)).not.toMatch(/Cloudflare|Workers|Wrangler|workerd|Vercel/);
    }
    const start = await text("/guide/getting-started");
    for (const required of [
      "vp create effront -- my-app --platform node",
      "cd my-app",
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
      'href="https://github.com/totto2727-org/effront/blob/main/examples/node/src/entry.effront.tsx"',
    );
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
        if (guide !== "guide/getting-started") {
          expect(source).toContain(guide === "platforms/alchemy" ? "vp run dev" : "vp dev");
        }
        expect(source).not.toMatch(/vp pack|vp preview/);
      }
      const start = readFileSync(
        new URL(`./${directory}/guide/getting-started.md`, import.meta.url),
        "utf8",
      );
      expect([...start.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1])).toEqual([
        "vp create effront -- my-app --platform node\ncd my-app\nvp install\nvp dev",
      ]);
      expect(start).toContain("```tsx\nconst HomePage = EFFRONT.Page.make({");
      expect(start).toContain("render: () => Effect.succeed(<h1>Hello, Effront</h1>),");
      expect(start).toContain("../platforms.md");
      expect(start).not.toMatch(/\.\.\/platforms\/(bun|cloudflare|alchemy)\.md/);
      expect(start).not.toMatch(/--platform (bun|cloudflare|alchemy-cloudflare)/);
      const alchemy = readFileSync(
        new URL(`./${directory}/platforms/alchemy.md`, import.meta.url),
        "utf8",
      );
      expect(
        alchemy.startsWith(locale === "en" ? "## Prepare the example" : "## サンプルを準備する"),
      ).toBe(true);
      const html = await render(`/${locale}/guide/getting-started`);
      expect(html).toContain(`href="/${locale}/platforms"`);
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

  it.each(["node", "bun"])(
    "%s keeps development separate from preparation and uses its native production listener",
    (example) => {
      const manifest = JSON.parse(
        readFileSync(
          new URL(`../../../../examples/${example}/package.json`, import.meta.url),
          "utf8",
        ),
      ) as { scripts: Record<string, string> };
      expect(manifest.scripts).toEqual({
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
    const alchemy = await render("/platforms/alchemy");
    expect(alchemy).toContain("profile");
    expect(alchemy).toContain('href="https://alchemy.run/');
    const lifetime = await text("/advanced/request-runtime-and-lifetimes");
    for (const contract of [
      "Effect.acquireRelease",
      "Layer.effect",
      "Effect.scoped",
      "Layer.succeed",
    ]) {
      expect(lifetime).toContain(contract);
    }
    const lifetimeHtml = await render("/ja/advanced/request-runtime-and-lifetimes");
    expect(lifetimeHtml).toContain('href="/ja/api-reference/http#capture"');
    expect(lifetimeHtml).toContain('href="/ja/api-reference/http#handler"');
  });

  it.each(["en", "ja"] as const)(
    "links runnable platform examples without fixing Vite development ports in %s",
    async (locale) => {
      const repository = new URL("../../../../", import.meta.url);
      for (const [slug, example] of [
        ["node", "node"],
        ["bun", "bun"],
        ["cloudflare", "cloudflare"],
      ] as const) {
        const html = await render(`/${locale}/platforms/${slug}`);
        const prose = await text(`/${locale}/platforms/${slug}`);
        const config = readFileSync(
          new URL(`examples/${example}/vite.config.ts`, repository),
          "utf8",
        );
        expect(config).not.toContain("server:");
        expect(prose).toMatch(/local URL printed by Vite|Vite が表示するローカル URL/);
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
        const application = readFileSync(
          new URL(`examples/${example}/src/entry.effront.tsx`, repository),
          "utf8",
        );
        expect(application).toContain("<h1>Hello, world</h1>");
        expect(application).not.toContain("Count: 0");
        expect(prose).not.toContain("Count: 0");
        expect(prose).toContain(`vp create effront -- my-app --platform ${slug}`);
        expect(prose).toContain("cd my-app\nvp install");
        expect(prose).not.toContain("git clone");
        expect(prose).not.toContain("vp pack");
        expect(prose).not.toContain("vp add");
      }
      const alchemy = await render(`/${locale}/platforms/alchemy`);
      expect(alchemy).toContain(
        'href="https://github.com/totto2727-org/effront/tree/main/examples/basic"',
      );
      expect(await text(`/${locale}/platforms/alchemy`)).toContain("Hello, world");
      expect(await text(`/${locale}/platforms/alchemy`)).toContain(
        "vp create effront -- my-app --platform alchemy-cloudflare\ncd my-app\nvp install",
      );
      expect(await text(`/${locale}/platforms/alchemy`)).not.toContain("git clone");
      expect(
        readFileSync(
          new URL("examples/alchemy-cloudflare/src/entry.effront.tsx", repository),
          "utf8",
        ),
      ).toContain("<h1>Hello, world</h1>");
      expect(
        readFileSync(
          new URL("examples/alchemy-cloudflare/src/entry.workers.ts", repository),
          "utf8",
        ),
      ).toContain("makeApplicationHttpEffect");
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
      expect(source).toContain("`/articles/hello`");
    },
  );

  it.each(["en", "ja"] as const)(
    "keeps guide URL instructions concise and host-neutral in %s",
    async (locale) => {
      for (const guide of [
        "routes",
        "components",
        "effect",
        "server-functions",
        "middleware",
        "markdown",
        "http",
      ]) {
        const html = await render(`/${locale}/guide/${guide}`);
        expect(html).not.toContain("127.0.0.1:1340");
        expect(html).not.toMatch(/開発サーバー\s*に\s*表示された\s*URL/);
      }
      const config = readFileSync(
        new URL("../../../../examples/node/vite.config.ts", import.meta.url),
        "utf8",
      );
      expect(config).not.toContain("server:");
    },
  );

  it.each(["/api-reference", "/ja/api-reference", "/en/api-reference"])(
    "%s indexes every public package export and the manifest release version",
    async (slug) => {
      const html = await render(slug);
      const root = new URL("../../../../packages/", import.meta.url);
      for (const name of readdirSync(root).filter((name) => name !== "create-effront")) {
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

  it.each(["en", "ja"])(
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
          ? "Markdown received from external sources at runtime"
          : "実行時に外部から受け取る Markdown",
      );
      expect(prose).toContain(
        locale === "en" ? "implement your own endpoint and rendering" : "独自のエンドポイント",
      );
      expect(prose).toContain("content/");
      expect(prose).toContain("basePath");
      expect(prose).toContain("content/manual.md → /manual");
      expect(prose).toContain("content/manual/index.md → /manual/index");
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
