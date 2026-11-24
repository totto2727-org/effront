import { access, readFile, readdir } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { getPage, localizedPages, pages } from "./pages.ts";
import { documentLocale, localizedPath } from "./locale.ts";

import { render, text } from "./pages-render.fixture.ts";

describe("documentation catalog", () => {
  test.each(["node", "bun"])(
    "%s keeps development separate from preparation and uses its native production listener",
    async (example) => {
      const manifest = JSON.parse(
        await readFile(
          new URL(`../../../../examples/${example}/package.json`, import.meta.url),
          "utf8",
        ),
      ) as { scripts: Record<string, string> };
      expect(manifest.scripts).toStrictEqual({
        start: `${example === "bun" ? "bun" : "node"} dist/rsc/server.js`,
      });
    },
  );

  test.each(["en", "ja"] as const)(
    "documents prerequisites, installation and native entry configuration in %s",
    async (locale) => {
      for (const slug of [
        "/guide/getting-started",
        "/platforms/node",
        "/platforms/bun",
        "/platforms/cloudflare",
        "/platforms/alchemy",
      ]) {
        const path = `/${locale}${slug}`;
        await expect(text(path)).resolves.toContain("vp install");
      }
      for (const host of ["node", "bun"]) {
        const content = await text(`/${locale}/platforms/${host}`);
        expect(content).not.toContain(`examples/${host}`);
        expect(content).toContain(
          locale === "en"
            ? "After the build, run from the generated project"
            : "ビルド後、生成したプロジェクトで次を実行します",
        );
      }
      const server = await text(`/${locale}/api-reference/server`);
      ["effront({ rsc })", "effrontServer({ rsc })", "Effect Schema JIT"].forEach((contract) => {
        expect(server).toContain(contract);
      });
      expect(server).toContain(locale === "en" ? "pass the same path" : "同じパスを指定");
    },
  );

  test("describes implemented hosts and separates Bun production from Vite middleware", async () => {
    const platforms = await render("/platforms");
    ["cloudflare", "alchemy", "node", "bun"].forEach((host) => {
      expect(platforms).toContain(`href="/platforms/${host}"`);
    });
    ["@effront/cloudflare", "@effront/alchemy", "@effront/server"].forEach((adapter) => {
      expect(platforms).toContain(adapter);
    });
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
      await expect(render(`/platforms/${host}`)).resolves.toContain('href="/api-reference/server"');
    }
    const bun = await text("/platforms/bun");
    ["Bun", "@effect/platform-node", "@effect/platform-bun"].forEach((required) => {
      expect(bun).toContain(required);
    });
    await expect(render("/platforms/bun")).resolves.toContain(
      'href="https://bun.sh/docs/installation"',
    );
    const alchemy = await render("/platforms/alchemy");
    expect(alchemy).toContain("profile");
    expect(alchemy).toContain('href="https://alchemy.run/');
    const lifetime = await text("/advanced/request-runtime-and-lifetimes");
    ["Effect.acquireRelease", "Layer.effect", "Effect.scoped", "Layer.succeed"].forEach(
      (contract) => {
        expect(lifetime).toContain(contract);
      },
    );
    const lifetimeHtml = await render("/ja/advanced/request-runtime-and-lifetimes");
    expect(lifetimeHtml).toContain('href="/ja/api-reference/http#capture"');
    expect(lifetimeHtml).toContain('href="/ja/api-reference/http#handler"');
  });

  test.each(["en", "ja"] as const)(
    "checks generated platform guides without fixing Vite development ports in %s",
    async (locale) => {
      const viteReference = await render(`/${locale}/api-reference/vite`);
      expect(viteReference).toContain(`href="/${locale}/platforms/cloudflare#vite"`);
      expect(viteReference).toContain(`href="/${locale}/guide/getting-started"`);
      const repository = new URL("../../../../", import.meta.url);
      for (const [slug, example] of [
        ["node", "node"],
        ["bun", "bun"],
        ["cloudflare", "cloudflare"],
      ] as const) {
        const html = await render(`/${locale}/platforms/${slug}`);
        const prose = await text(`/${locale}/platforms/${slug}`);
        const config = await readFile(
          new URL(`examples/${example}/vite.config.ts`, repository),
          "utf8",
        );
        expect(config).not.toContain("server:");
        expect(prose).toMatch(/local URL printed by Vite|Vite が表示するローカル URL/u);
        expect(config).not.toContain("preview:");
        expect(prose).not.toContain("vp preview");
        if (slug === "cloudflare") {
          expect(prose).toContain(
            "vp build\nvp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787",
          );
          expect(html).toContain('href="http://127.0.0.1:8787"');
        }
        for (const file of ["src/entry.effront.tsx", "vite.config.ts", "package.json"]) {
          expect(prose).toContain(file);
          await expect(
            readFile(new URL(`examples/${example}/${file}`, repository), "utf8"),
          ).resolves.not.toBe("");
        }
        const application = await readFile(
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
      await expect(text(`/${locale}/platforms/alchemy`)).resolves.toContain("Hello, world");
      await expect(text(`/${locale}/platforms/alchemy`)).resolves.toContain(
        "vp create effront -- my-app --platform alchemy-cloudflare\ncd my-app\nvp install",
      );
      await expect(text(`/${locale}/platforms/alchemy`)).resolves.not.toContain("git clone");
      await expect(
        readFile(new URL("examples/alchemy-cloudflare/src/entry.effront.tsx", repository), "utf8"),
      ).resolves.toContain("<h1>Hello, world</h1>");
      await expect(
        readFile(new URL("examples/alchemy-cloudflare/src/entry.workers.ts", repository), "utf8"),
      ).resolves.toContain("makeApplicationHttpEffect");
      const chooser = await render(`/${locale}/platforms`);
      ["setup", "entries", "assets", "node", "bun"].forEach((id) => {
        expect(chooser).toContain(`id="${id}"`);
      });
      expect(chooser).not.toContain("node-bun");
      expect(() => getPage(`/${locale}/platforms/node-bun`)).toThrow(
        "Documentation route is missing content",
      );
    },
  );

  test.each(["en", "ja"] as const)(
    "introduces Layout, Page, Routes, then the complete entry in %s",
    async (locale) => {
      const directory = locale === "en" ? "en/articles" : "articles";
      const source = await readFile(
        new URL(`./${directory}/guide/routes.md`, import.meta.url),
        "utf8",
      );
      const sections = source.split(/^## /mu).slice(1);
      expect(
        sections.slice(0, 4).map((section) => /\{#([^}]+)\}/.exec(section)?.[1]),
      ).toStrictEqual(["layouts", "pages", "routes", "application"]);
      const code = (section: string): string => /```tsx\n([\s\S]*?)\n```/.exec(section)?.[1] ?? "";
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

  test.each(["en", "ja"] as const)(
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
        expect(html).not.toMatch(/開発サーバー\s*に\s*表示された\s*URL/u);
      }
      const config = await readFile(
        new URL("../../../../examples/node/vite.config.ts", import.meta.url),
        "utf8",
      );
      expect(config).not.toContain("server:");
    },
  );

  test.each(["/api-reference", "/ja/api-reference", "/en/api-reference"])(
    "%s indexes every public code export without duplicating release versions",
    async (slug) => {
      const html = await render(slug);
      expect(html).toContain("peerDependencies");
      expect(html).toContain("lockfile");
      expect(html).not.toMatch(/\b\d+\.\d+\.\d+\b/u);
      const root = new URL("../../../../packages/", import.meta.url);
      for (const name of (await readdir(root)).filter((name) => name !== "create-effront")) {
        const manifest = JSON.parse(
          await readFile(new URL(`${name}/package.json`, root), "utf8"),
        ) as {
          name: string;
          exports: Record<string, unknown>;
        };
        for (const subpath of Object.keys(manifest.exports).filter(
          (path) => !path.includes("/internal/") && !path.endsWith(".css"),
        )) {
          expect(html).toContain(
            subpath === "." ? manifest.name : `${manifest.name}${subpath.slice(1)}`,
          );
        }
      }
    },
  );

  test("keeps ordinary installation examples unversioned in both locales and READMEs", async () => {
    const articles = await Promise.all(
      ["articles", "en/articles"].map(async (directory) => {
        const files = await readdir(new URL(`./${directory}/`, import.meta.url), {
          recursive: true,
          encoding: "utf8",
        });
        return files
          .filter((path) => path.endsWith(".md"))
          .map((path) => new URL(`./${directory}/${path}`, import.meta.url));
      }),
    );
    const repository = new URL("../../../../", import.meta.url);
    const packages = await readdir(new URL("packages/", repository));
    const sources = [
      ...articles.flat(),
      new URL("README.md", repository),
      ...packages.map((name) => new URL(`packages/${name}/README.md`, repository)),
    ];
    const contents = await Promise.all(sources.map((source) => readFile(source, "utf8")));
    const commands = contents.flatMap(
      (source) => source.match(/(?:vp add|npm install|pnpm add|bun add|yarn add)\b[^`\n]*/g) ?? [],
    );
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      expect(command).not.toMatch(/(?:@[a-z\d._-]+\/)?[a-z\d._-]+@[^\s'"]+/i);
    }
  });

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
