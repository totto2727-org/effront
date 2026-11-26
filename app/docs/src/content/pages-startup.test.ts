import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { render, text, textOf } from "./pages-render.fixture.ts";
import {
  editions,
  quickstartCommands,
  shellExamples,
  startupCases,
  startupSource,
} from "./pages-startup.fixture.ts";

const gettingStarted = "/guide/getting-started";
const essentialGuides = [
  "/guide/routes",
  "/guide/components",
  "/guide/effect",
  "/guide/server-functions",
  "/guide/mutation-server-functions",
  "/guide/query-server-functions",
  "/guide/stream-server-functions",
  "/guide/middleware",
  "/guide/http",
];
const quickstartTerms = [
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
];
const effectTerms = ["Context.Service", "Layer", "Application.effront"];

describe("host-neutral conceptual guides", () => {
  test.each(essentialGuides)("keeps %s independent of deployment providers", async (slug) => {
    await expect(text(slug)).resolves.not.toMatch(/Cloudflare|Workers|Wrangler|workerd|Vercel/u);
  });

  test("links the create-and-run quickstart and shows every required source file", async () => {
    const html = await render(gettingStarted);
    const content = textOf(html);
    expect(Array.filter(quickstartTerms, (required) => content.includes(required))).toStrictEqual(
      quickstartTerms,
    );
    expect(content).not.toContain("vp add");
    expect(html).toContain(
      'href="https://github.com/totto2727-org/effront/blob/main/examples/node/src/entry.effront.tsx"',
    );
  });

  test("introduces the Effect service and layer contracts with links to Effect", async () => {
    const html = await render("/guide/effect");
    const content = textOf(html);
    expect(Array.filter(effectTerms, (term) => content.includes(term))).toStrictEqual(effectTerms);
    expect(html).toContain('href="https://effect.website/');
  });
});

const platformScenarios = Array.flatMap(editions, (locale) =>
  Array.map(startupCases, ({ article, command }) => ({ article, command, locale })),
);
const alchemyTitles = [
  { heading: "## Prepare the example", locale: "en" },
  { heading: "## サンプルを準備する", locale: "ja" },
] as const;
const requiredQuickstart = [
  "vp install",
  "```tsx\nconst HomePage = EFFRONT.Page.make({",
  "render: () => Effect.succeed(<h1>Hello, Effront</h1>),",
  "../platforms.md",
];

describe("startup commands in the published examples", () => {
  test.each(platformScenarios)(
    "shows the local Vite+ command for $article in $locale",
    ({ article, command, locale }) => {
      const source = startupSource(locale, article);
      expect(source).toContain("vp install");
      expect(source).toContain(command);
      expect(source).not.toMatch(/vp pack|vp preview/u);
    },
  );

  test.each(editions)("keeps the bootstrap commands and single Node example in %s", (locale) => {
    const source = startupSource(locale, "guide/getting-started");
    expect(shellExamples(source)).toStrictEqual([quickstartCommands]);
    expect(Array.filter(requiredQuickstart, (term) => source.includes(term))).toStrictEqual(
      requiredQuickstart,
    );
    expect(source).not.toMatch(
      /vp pack|vp preview|\.\.\/platforms\/(?:bun|cloudflare|alchemy)\.md|--platform (?:bun|cloudflare|alchemy-cloudflare)/u,
    );
  });

  test.each(alchemyTitles)(
    "starts the Alchemy article directly with setup in $locale",
    ({ heading, locale }) => {
      expect(startupSource(locale, "platforms/alchemy").startsWith(heading)).toBe(true);
    },
  );

  test.each(editions)(
    "renders the platform guide link and highlighted starter code in %s",
    async (locale) => {
      const html = await render(`/${locale}${gettingStarted}`);
      expect(html).toContain(`href="/${locale}/platforms"`);
      expect(html).toContain('data-language="tsx"');
      expect(html).toContain("--shiki-dark");
    },
  );
});

const expectedAlerts = [
  { slug: "guide/components", type: "warning" },
  { slug: "guide/routes", type: "warning" },
  { slug: "platforms/cloudflare", type: "warning" },
  { slug: "platforms/alchemy", type: "important" },
];
const alertScenarios = Array.flatMap(editions, (locale) =>
  Array.map(expectedAlerts, ({ slug, type }) => ({ locale, slug, type })),
);

describe("default Comark reader cautions", () => {
  test.each(alertScenarios)(
    "renders the $type alert for $slug in $locale",
    async ({ locale, slug, type }) => {
      const html = await render(`/${locale}/${slug}`);
      expect(html).toContain(`data-alert="${type}"`);
      expect(html).not.toContain(`[!${type.toUpperCase()}]`);
    },
  );
});
