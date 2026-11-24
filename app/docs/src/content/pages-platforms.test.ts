import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  installGuides,
  locales,
  matchingTerms,
  nativeHosts,
  nativeScripts,
} from "./pages-platform-fixtures.ts";
import { render, text, textOf } from "./pages-render.fixture.ts";

const installations = Array.flatMap(locales, (locale) =>
  Array.map(installGuides, (slug) => `/${locale}${slug}`),
);
const productionNotes = [
  { locale: "en", note: "After the build, run from the generated project" },
  { locale: "ja", note: "ビルド後、生成したプロジェクトで次を実行します" },
] as const;
const productionCases = Array.flatMap(productionNotes, ({ locale, note }) =>
  Array.map(nativeHosts, (host) => ({ host, locale, note })),
);

describe("native startup commands and prerequisites", () => {
  test.each(installations)("includes the installation step in %s", async (path) => {
    await expect(text(path)).resolves.toContain("vp install");
  });

  test.each(nativeHosts)("gives %s the native production listener as its only script", (host) => {
    expect(nativeScripts(host)).toStrictEqual({ start: `${host} dist/rsc/server.js` });
  });

  test.each(productionCases)(
    "describes running the generated $host project in $locale",
    async ({ host, locale, note }) => {
      const content = await text(`/${locale}/platforms/${host}`);
      expect(content).not.toContain(`examples/${host}`);
      expect(content).toContain(note);
    },
  );
});

const serverContracts = ["effront({ rsc })", "effrontServer({ rsc })", "Effect Schema JIT"];
const sharedEntry = [
  { locale: "en", note: "pass the same path" },
  { locale: "ja", note: "同じパスを指定" },
] as const;
const hostPaths = ["cloudflare", "alchemy", "node", "bun"];
const adapterNames = ["@effront/cloudflare", "@effront/alchemy", "@effront/server"];

describe("platform and server references", () => {
  test.each(sharedEntry)(
    "requires consistent entry configuration in $locale",
    async ({ locale, note }) => {
      const server = await text(`/${locale}/api-reference/server`);
      expect(matchingTerms(server, serverContracts)).toStrictEqual(serverContracts);
      expect(server).toContain(note);
    },
  );

  test("lists the implementation hosts and their corresponding adapters", async () => {
    const platforms = await render("/platforms");
    const hostLinks = Array.map(hostPaths, (host) => `href="/platforms/${host}"`);
    expect(matchingTerms(platforms, hostLinks)).toStrictEqual(hostLinks);
    expect(matchingTerms(platforms, adapterNames)).toStrictEqual(adapterNames);
  });
});

const hostCommands = [
  "effrontServer()",
  "dist/client/assets",
  "vp dev",
  "vp build",
  "vp run start",
];

describe("native production listeners", () => {
  test.each(nativeHosts)(
    "documents native %s startup and links its server adapter",
    async (host) => {
      const html = await render(`/platforms/${host}`);
      const required = [`${host} dist/rsc/server.js`, `@effront/server/${host}`, ...hostCommands];
      expect(matchingTerms(textOf(html), required)).toStrictEqual(required);
      expect(html).toContain('href="/api-reference/server"');
    },
  );

  test("separates Bun's runtime setup from the platform adapters", async () => {
    const bun = await render("/platforms/bun");
    const required = ["Bun", "@effect/platform-node", "@effect/platform-bun"];
    expect(matchingTerms(textOf(bun), required)).toStrictEqual(required);
    expect(bun).toContain('href="https://bun.sh/docs/installation"');
  });

  test("links the official Alchemy profile setup", async () => {
    const alchemy = await render("/platforms/alchemy");
    expect(alchemy).toContain("profile");
    expect(alchemy).toContain('href="https://alchemy.run/');
  });
});

const lifetimeTerms = ["Effect.acquireRelease", "Layer.effect", "Effect.scoped", "Layer.succeed"];

describe("request lifetime documentation", () => {
  test("explains resource ownership and links the HTTP runtime contracts", async () => {
    const lifetime = await text("/advanced/request-runtime-and-lifetimes");
    const localized = await render("/ja/advanced/request-runtime-and-lifetimes");
    expect(matchingTerms(lifetime, lifetimeTerms)).toStrictEqual(lifetimeTerms);
    expect(localized).toContain('href="/ja/api-reference/http#capture"');
    expect(localized).toContain('href="/ja/api-reference/http#handler"');
  });
});
