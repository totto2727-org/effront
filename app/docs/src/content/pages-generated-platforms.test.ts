import { Array, String } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { exampleSource, locales, matchingTerms } from "./pages-platform-fixtures.ts";
import { render, textOf } from "./pages-render.fixture.ts";
import { getPage } from "./pages.ts";

const workersLaunch =
  "vp build\nvp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787";
const projects = ["node", "bun", "cloudflare"];
const articles = Array.flatMap(locales, (locale) =>
  Array.map(projects, (project) => ({ locale, project })),
);
const guideFiles = ["src/entry.effront.tsx", "vite.config.ts", "package.json"];
const unwantedCommands = /Count: 0|vp preview|git clone|vp pack|vp add/u;
const starterMarkup = "<h1>Hello, world</h1>";
const cloudflareReference = "/platforms/cloudflare#vite";

describe("generated Vite starter guides", () => {
  test.each(articles)(
    "documents the generated $project project and Vite-assigned host in $locale",
    async ({ locale, project }) => {
      const prose = textOf(await render(`/${locale}/platforms/${project}`));
      const required = [
        ...guideFiles,
        `vp create effront -- my-app --platform ${project}`,
        "cd my-app\nvp install",
      ];
      expect(matchingTerms(prose, required)).toStrictEqual(required);
      expect(prose).not.toMatch(unwantedCommands);
      expect(prose).toMatch(/local URL printed by Vite|Vite が表示するローカル URL/u);
    },
  );

  test.each(projects)(
    "keeps the generated %s sources and leaves Vite ports automatic",
    (project) => {
      const present = Array.filter(
        guideFiles,
        (file) => !String.isEmpty(exampleSource(project, file)),
      );
      const application = exampleSource(project, "src/entry.effront.tsx");
      const configuration = exampleSource(project, "vite.config.ts");
      expect(present).toStrictEqual(guideFiles);
      expect(application).toContain(starterMarkup);
      expect(application).not.toContain("Count: 0");
      expect(configuration).not.toMatch(/server:|preview:/u);
    },
  );
});

describe("cloudflare native setup and generated entry references", () => {
  test.each(locales)("documents Wrangler's local preview command and URL in %s", async (locale) => {
    const html = await render(`/${locale}/platforms/cloudflare`);
    expect(textOf(html)).toContain(workersLaunch);
    expect(html).toContain('href="http://127.0.0.1:8787"');
  });

  test.each(locales)(
    "links the native platform and quickstart guides from the Vite reference in %s",
    async (locale) => {
      const vite = await render(`/${locale}/api-reference/vite`);
      expect(vite).toContain(`href="/${locale}${cloudflareReference}"`);
      expect(vite).toContain(`href="/${locale}/guide/getting-started"`);
    },
  );

  test.each(locales)(
    "shows the Alchemy starter and links the runnable example in %s",
    async (locale) => {
      const alchemy = await render(`/${locale}/platforms/alchemy`);
      const prose = textOf(alchemy);
      expect(alchemy).toContain(
        'href="https://github.com/totto2727-org/effront/tree/main/examples/basic"',
      );
      expect(prose).toContain("Hello, world");
      expect(prose).toContain(
        "vp create effront -- my-app --platform alchemy-cloudflare\ncd my-app\nvp install",
      );
      expect(prose).not.toContain("git clone");
    },
  );

  test("retains the Alchemy application and native worker entry files", () => {
    expect(exampleSource("alchemy-cloudflare", "src/entry.effront.tsx")).toContain(starterMarkup);
    expect(exampleSource("alchemy-cloudflare", "src/entry.workers.ts")).toContain(
      "makeApplicationHttpEffect",
    );
  });
});

const platformAnchors = ["setup", "entries", "assets", "node", "bun"];

describe("published host chooser", () => {
  test.each(locales)(
    "preserves the host chooser anchors and retires node-bun in %s",
    async (locale) => {
      const chooser = await render(`/${locale}/platforms`);
      const anchors = Array.map(platformAnchors, (id) => `id="${id}"`);
      expect(matchingTerms(chooser, anchors)).toStrictEqual(anchors);
      expect(chooser).not.toContain("node-bun");
      expect(() => getPage(`/${locale}/platforms/node-bun`)).toThrow(
        "Documentation route is missing content",
      );
    },
  );
});
