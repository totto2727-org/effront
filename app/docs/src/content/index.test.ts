import { readFileSync, readdirSync } from "node:fs";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { getPage, navigation, pages } from "./index";
import { articleCatalog } from "./catalog";

const render = async (slug: string) =>
  renderToStaticMarkup(await Effect.runPromise(getPage(slug).content()));
const text = async (slug: string) => (await render(slug)).replace(/<[^>]*>/g, "");

// These are published URLs, not a count that can silently hide a removed article.
const retainedUrls = [
  "/",
  "/guide/getting-started",
  "/guide/routes",
  "/guide/components",
  "/guide/effect",
  "/guide/testing",
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
    expect(pages.map((page) => page.slug)).toEqual(expect.arrayContaining(retainedUrls));
    expect(new Set(pages.map((page) => page.slug)).size).toBe(pages.length);
    expect(JSON.parse(JSON.stringify(navigation))).toEqual(navigation);
    expect([...new Set(pages.map((page) => page.section))]).toEqual([
      "Getting started",
      "Platforms",
      "Guides",
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

  it("keeps every Markdown document registered, including the explicit root alias", () => {
    const sources = Object.keys(import.meta.glob("./articles/**/*.md"));
    expect(articleCatalog.map((page) => `./articles${page.source}.md`).toSorted()).toEqual(
      sources.toSorted(),
    );
    expect(articleCatalog.find((page) => page.slug === "/")?.source).toBe("/index");
    expect(() => getPage("/index")).toThrow("Documentation route is missing content");
  });

  it("keeps conceptual guides host-neutral and provides a complete selectable quickstart", async () => {
    for (const slug of [
      "/guide/routes",
      "/guide/components",
      "/guide/effect",
      "/guide/server-functions",
      "/guide/middleware",
      "/guide/http",
      "/guide/testing",
    ]) {
      expect(await text(slug)).not.toMatch(/Cloudflare|Workers|Wrangler|workerd|Vercel/);
    }
    const start = await text("/guide/getting-started");
    for (const required of [
      "vp add @effront/core@0.1.3",
      "effect@4.0.0-rc.112",
      "effrontCloudflare()",
      "createFetchHandler(application)",
      "nodejs_compat",
      "entry.workers.ts",
      "dist/rsc/wrangler.json",
      "Node.js / Bun",
    ]) {
      expect(start).toContain(required);
    }
    expect(start).not.toMatch(/vp install|チェックアウト|workspace依存/);
    expect(await text("/guide/testing")).toContain("フォーム送信");
    for (const diagnostic of ["TS2769", "TS2345", "TS2322"]) {
      expect(await text("/guide/effect")).toContain(diagnostic);
    }
  });

  it("describes implemented hosts and separates Bun production from Vite middleware", async () => {
    expect(await text("/platforms")).toContain("@effront/server");
    expect(await text("/platforms")).toContain("Vercel と AWS の専用アダプターは提供していません");
    const native = await text("/platforms/node-bun");
    for (const required of [
      "node dist/rsc/server.js",
      "bun dist/rsc/server.js",
      "Node 互換",
      "Bun 1.4.2",
      "@effect/platform-node",
      "effrontServer()",
      "Layer.launch",
    ]) {
      expect(native).toContain(required);
    }
    expect(await text("/platforms")).toContain(
      "SSR モジュールとブラウザーアセットを含む成果物全体",
    );
    expect(await text("/guide/testing")).toContain("JavaScript 無効時のフォーム送信");
    expect(await text("/platforms/alchemy")).toContain("profile が必要");
    expect(await text("/advanced/request-runtime-and-lifetimes")).toContain(
      "ハンドラーを作り、リクエスト間で再利用",
    );
  });

  it("indexes every public package export and the manifest release version", async () => {
    const html = await render("/api-reference");
    const root = new URL("../../../../packages/", import.meta.url);
    for (const name of readdirSync(root)) {
      const manifest = JSON.parse(readFileSync(new URL(`${name}/package.json`, root), "utf8")) as {
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
  });

  it("keeps Markdown caveats and server-only highlighting visible", async () => {
    const html = await render("/guide/markdown");
    expect(html).toContain('href="/guide/getting-started#application"');
    expect(html).toContain('data-code-block=""');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("--shiki-dark");
    expect(html).toContain("sanitize");
    expect(html).toContain("Math / Mermaid SSR");
    expect(html).toContain("MarkdownError");
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

  it("rejects missing content instead of silently rendering another page", () => {
    expect(() => getPage("/not-a-document")).toThrow("Documentation route is missing content");
  });

  it.each(pages)(
    "$slug renders every table-of-contents target and valid internal links",
    async (page) => {
      const html = await render(page.slug);
      expect(page.headings.length).toBeGreaterThan(0);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(ids).size).toBe(ids.length);
      for (const heading of page.headings) {
        expect(heading.id).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(ids).toContain(heading.id);
      }
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (!href || (!href.startsWith("/") && !href.startsWith("#"))) continue;
        const url = new URL(href, `https://docs.example${page.slug}`);
        const target = getPage(url.pathname);
        if (url.hash) {
          const targetHtml = url.pathname === page.slug ? html : await render(target.slug);
          expect(targetHtml, `${page.slug} -> ${href}`).toContain(`id="${url.hash.slice(1)}"`);
        }
      }
    },
  );
});
