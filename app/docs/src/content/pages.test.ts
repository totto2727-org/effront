import { describe, expect, test } from "vite-plus/test";
import { getPage, localizedPages, pages } from "./pages.ts";
import { documentLocale, localizedPath } from "./locale.ts";

import { render, text } from "./pages-render.fixture.ts";

describe("documentation catalog", () => {
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
