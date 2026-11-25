import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import japaneseRoutes from "./articles/guide/routes.md?raw";
import englishRoutes from "./en/articles/guide/routes.md?raw";
import { exampleSource, locales } from "./pages-platform-fixtures.ts";
import { render } from "./pages-render.fixture.ts";

const routesArticles = [
  { locale: "en", source: englishRoutes },
  { locale: "ja", source: japaneseRoutes },
];
const requiredSections = ["layouts", "pages", "routes", "application"];
const sectionHeading = /^## /mu;
const headingId = /\{#(?<id>[^}]+)\}/u;
const firstExample = /```tsx\n(?<source>[\s\S]*?)\n```/u;

const parseExamples = (article: string): Readonly<{ ids: string[]; sources: string[] }> => {
  const sections = Array.drop(article.split(sectionHeading), 1);
  const included = Array.take(sections, requiredSections.length);
  return {
    ids: Array.map(included, (section) => headingId.exec(section)?.groups?.["id"] ?? ""),
    sources: Array.map(included, (section) => firstExample.exec(section)?.groups?.["source"] ?? ""),
  };
};

describe("route authoring guide", () => {
  test.each(routesArticles)(
    "introduces Layout, Page, Routes, and the complete entry in $locale",
    ({ source }) => {
      const { ids, sources } = parseExamples(source);
      const [layout = "", page = "", routes = "", application = ""] = sources;
      expect(ids).toStrictEqual(requiredSections);
      expect({
        layoutDeclaresLayout: layout.includes("EFFRONT.Layout.make"),
        layoutDeclaresPage: layout.includes("EFFRONT.Page.make"),
        pageDeclaresPage: page.includes("EFFRONT.Page.make"),
        pageDeclaresRoutes: page.includes("EFFRONT.Routes.make"),
      }).toStrictEqual({
        layoutDeclaresLayout: true,
        layoutDeclaresPage: false,
        pageDeclaresPage: true,
        pageDeclaresRoutes: false,
      });
      expect(routes).toContain('Routes.make({ layout: RootLayout }).page("/", HomePage)');
      expect(application).toContain("export default EFFRONT.make({ routes })");
      expect(source).toContain("`/articles/hello`");
    },
  );
});

const guidePaths = [
  "routes",
  "components",
  "effect",
  "server-functions",
  "middleware",
  "markdown",
  "http",
];
const publishedGuides = Array.flatMap(locales, (locale) =>
  Array.map(guidePaths, (guide) => `/${locale}/guide/${guide}`),
);

describe("conceptual guide URL instructions", () => {
  test.each(publishedGuides)(
    "avoids hard-coded development hosts and startup prose in %s",
    async (slug) => {
      const html = await render(slug);
      expect(html).not.toMatch(/127\.0\.0\.1:1340|開発サーバー\s*に\s*表示された\s*URL/u);
    },
  );

  test("leaves the Node example development address to Vite", () => {
    expect(exampleSource("node", "vite.config.ts")).not.toContain("server:");
  });
});
