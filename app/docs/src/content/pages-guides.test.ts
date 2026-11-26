import { Array, Predicate } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { documentPath, localizedPath } from "./locale.ts";
import {
  authoredHeadings,
  editions,
  publishedHeadings,
  renderedAnchors,
} from "./pages-guide-headings.fixture.ts";
import { render, textOf } from "./pages-render.fixture.ts";
import { getPage, localizedNavigation } from "./pages.ts";

const bestPracticeOrder = [
  "/best-practices/authentication-and-authorization",
  "/best-practices/server-function-error-handling",
  "/advanced/request-runtime-and-lifetimes",
  "/best-practices/testing",
];
const includesGroup = (item: ReturnType<typeof localizedNavigation>[number]): boolean =>
  (item.section === "Best practices" || item.section === "Guides") &&
  Predicate.isNotNullish(item.group);

const titles = [
  {
    access: "Authentication and authorization",
    lifetime: "Manage service lifetimes",
    locale: "en",
  },
  {
    access: "認証と認可",
    lifetime: "サービスの生存期間を管理する",
    locale: "ja",
  },
] as const;

describe("guide and best practice navigation", () => {
  test.each(titles)(
    "keeps the published classifications and titles in $locale",
    ({ access, lifetime, locale }) => {
      const items = localizedNavigation(locale);
      const bestPractices = Array.filter(items, (item) => item.section === "Best practices");
      const auth = getPage(`/${locale}/best-practices/authentication-and-authorization`);
      const resource = getPage(`/${locale}/advanced/request-runtime-and-lifetimes`);
      const execution = getPage(`/${locale}/advanced/server-function-execution-and-refresh`);
      expect(Array.map(bestPractices, (item) => documentPath(item.slug))).toStrictEqual(
        bestPracticeOrder,
      );
      expect(Array.filter(items, (item) => includesGroup(item))).toStrictEqual([]);
      expect({
        access: auth.title,
        execution: execution.section,
        lifetime: resource.title,
      }).toStrictEqual({ access, execution: "Guides", lifetime });
    },
  );

  test.each(editions)("excludes retired guide URLs from the navigation in %s", (locale) => {
    const slugs = Array.map(localizedNavigation(locale), (item) => item.slug);
    expect(slugs).not.toContain(localizedPath("/advanced", locale));
    expect(slugs).not.toContain(localizedPath("/guide/testing", locale));
  });

  test.each(["/advanced", "/guide/testing"])("rejects the retired legacy route %s", (slug) => {
    expect(() => getPage(slug)).toThrow("Documentation route is missing content");
  });
});

const headingCases = Array.flatMap(editions, (locale) =>
  Array.map(publishedHeadings, ({ ids, slug }) => ({ ids, locale, slug })),
);
const anchorCases = Array.flatMap(editions, (locale) =>
  Array.map(renderedAnchors, ({ ids, slug }) => ({ ids, locale, slug })),
);

describe("published guide anchors", () => {
  test.each(headingCases)("matches $slug source headings in $locale", ({ ids, locale, slug }) => {
    const page = getPage(localizedPath(slug, locale));
    expect(Array.map(page.headings, (heading) => heading.id)).toStrictEqual(ids);
    expect(page.headings).toStrictEqual(authoredHeadings(locale, slug));
  });

  test.each(anchorCases)(
    "renders contextual anchors for $slug in $locale",
    async ({ ids, locale, slug }) => {
      const html = await render(localizedPath(slug, locale));
      expect(Array.filter(ids, (id) => html.includes(`id="${id}"`))).toStrictEqual(ids);
    },
  );
});

const testingExamples = [
  "@playwright/test",
  'request.get("/not-a-route")',
  "missing.status()).toBe(404)",
  'name: "Count: 1"',
  "element.isConnected",
  'getByTestId("action-greeting")',
  "Hello from Alchemy KV, Ada!",
  "TypeError",
];
const testingSources = [
  "tree/main/examples/basic",
  "tree/main/tests/e2e-alchemy",
  "blob/main/tests/e2e-alchemy/playwright.config.ts",
  "blob/main/docs/TESTING.md#native-alchemy-integration",
];
const testingNotes = [
  {
    locale: "en",
    notes: ["does not provide a public Vitest harness", "without Cloudflare authentication"],
  },
  {
    locale: "ja",
    notes: ["公開テストハーネスを提供していません", "Cloudflare の認証なし"],
  },
] as const;

describe("practical documentation testing guide", () => {
  test.each(testingNotes)(
    "covers runnable route, page, layout and Server Function checks in $locale",
    async ({ locale, notes }) => {
      const html = await render(localizedPath("/best-practices/testing", locale));
      const content = textOf(html).replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
      expect(Array.filter(testingExamples, (example) => content.includes(example))).toStrictEqual(
        testingExamples,
      );
      expect(
        Array.filter(testingSources, (path) =>
          html.includes(`href="https://github.com/totto2727-org/effront/${path}"`),
        ),
      ).toStrictEqual(testingSources);
      expect(Array.filter(notes, (note) => content.includes(note))).toStrictEqual(notes);
    },
  );
});
