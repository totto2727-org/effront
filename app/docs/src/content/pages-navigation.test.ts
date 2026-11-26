import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import navigationJa from "./articles/advanced/client-navigation.md?raw";
import navigationEn from "./en/articles/advanced/client-navigation.md?raw";
import { render, text, textOf } from "./pages-render.fixture.ts";
import { getPage, localizedNavigation } from "./pages.ts";

const route = "/advanced/client-navigation";
const componentDocs = "/api-reference/components";
const anchors = [
  "native-navigation",
  "transition-scope",
  "global-config",
  "commit-and-stream",
  "history-cache",
];
const notes = 3;
const navigationExamples = [
  "viewTransition: false",
  "layer: Layer.succeed(PageViewTransition, { enabled: false })",
  "viewTransition: { enabled: true }",
];
const referenceOnly = [
  "data-effront-transition-types",
  "hmr-refresh",
  "navigation-ua-visual-transition",
  "photo-fade",
];
const observed = (content: string, terms: string[]): string[] =>
  Array.filter(terms, (term) => content.includes(term));
const fencedExamples = (source: string): (string | undefined)[] => {
  const examples = Array.fromIterable(source.matchAll(/```tsx\n(?<example>[\s\S]*?)\n```/gu));
  return Array.map(examples, (match) => match.groups?.["example"]);
};

describe("native navigation documentation", () => {
  test.each(["en", "ja"] as const)(
    "lists the published route and ordered anchors directly under guides in %s",
    (locale) => {
      const slug = `/${locale}${route}`;
      const page = getPage(slug);
      expect({ group: page.group, section: page.section }).toStrictEqual({
        group: undefined,
        section: "Guides",
      });
      expect(localizedNavigation(locale).find((item) => item.slug === slug)).toStrictEqual({
        section: "Guides",
        slug,
        title: page.title,
      });
      expect(Array.map(page.headings, (heading) => heading.id)).toStrictEqual(anchors);
    },
  );

  test.each(["en", "ja"] as const)(
    "renders local examples and links to the component reference in %s",
    async (locale) => {
      const html = await render(`/${locale}${route}`);
      const content = textOf(html);
      expect(observed(content, navigationExamples)).toStrictEqual(navigationExamples);
      expect(html.match(/data-alert="note"/gu)).toHaveLength(notes);
      expect(html).toContain(`href="/${locale}${componentDocs}#view-transition"`);
      expect(content).not.toMatch(
        /\[!NOTE\]|transition boundary|遷移境界|NavigationPrecommitController/u,
      );
    },
  );

  test.each(["en", "ja"] as const)(
    "keeps reference-only details out of the guide in %s",
    async (locale) => {
      const [guide, reference] = await Promise.all([
        text(`/${locale}${route}`),
        text(`/${locale}${componentDocs}`),
      ]);
      expect(observed(guide, referenceOnly)).toStrictEqual([]);
      expect(observed(reference, referenceOnly)).toStrictEqual(referenceOnly);
    },
  );
});

describe("navigation article source", () => {
  test("keeps the four code examples identical across languages", () => {
    const english = fencedExamples(navigationEn);
    expect(english).toHaveLength(4);
    expect(fencedExamples(navigationJa)).toStrictEqual(english);
  });
});
