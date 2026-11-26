// oxlint-disable-next-line rules/no-node-imports -- Vite resolves this test fixture's absolute path using the current host.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The fixture location is relative to this test's module URL.
import { fileURLToPath } from "node:url";

import { normalizePath, resolveConfig } from "vite";
import type { Plugin, ResolvedConfig } from "vite";
import { assert, describe, expect, test } from "vite-plus/test";

import { effrontTailwind } from "./plugin.ts";

const root = fileURLToPath(new URL("../../../examples/basic/", import.meta.url));
const virtualStyle = "virtual:effront/tailwind.css";
const generatedPath = normalizePath(path.resolve(root, "style.css"));
const generatedStyle = `${generatedPath}?effront-tailwind`;
const generatedWithDirect = `${generatedStyle}&direct`;
const directWithGenerated = `${generatedPath}?direct&effront-tailwind`;

type Hook = NonNullable<Plugin["load"] | Plugin["resolveId"] | Plugin["transform"]>;
interface Integration {
  config: ResolvedConfig;
  load: (id: string) => unknown;
  resolve: (id: string) => unknown;
  transform: (source: string, id?: string) => unknown;
}

// Invoke the extension hooks the same way for Vite's function and object hook declarations.
const callHook = (hook: Hook, args: string[]): unknown =>
  Reflect.apply("handler" in hook ? hook.handler : hook, {}, args);

const integration = async (
  options: Parameters<typeof effrontTailwind>[number] = {},
): Promise<Integration> => {
  const config = await resolveConfig(
    {
      configFile: false,
      plugins: effrontTailwind(options),
      root,
    },
    "build",
  );
  const plugin = config.plugins.find((entry) => entry.name === "effront:tailwind");
  assert.isDefined(plugin);
  const { load, resolveId, transform } = plugin;
  assert.isDefined(load);
  assert.isDefined(resolveId);
  assert.isDefined(transform);
  return {
    config,
    load: (id) => callHook(load, [id]),
    resolve: (id) => callHook(resolveId, [id]),
    transform: (source, id = "/app/client.tsx") => callHook(transform, [source, id]),
  };
};

describe("tailwind plugin configuration", () => {
  test("includes the official Tailwind build plugin", async () => {
    const { config } = await integration();
    const names = config.plugins.map((entry) => entry.name);
    expect(names).toContain("@tailwindcss/vite:generate:build");
  });

  test("rejects an empty explicit stylesheet path", () => {
    expect(() => effrontTailwind({ stylesheet: "" })).toThrow(
      expect.objectContaining({
        message: "A stylesheet path must not be empty.",
        name: "TypeError",
      }),
    );
  });
});

describe("virtual stylesheets", () => {
  test.each([
    [virtualStyle, generatedStyle],
    ["/style.css?effront-tailwind", generatedStyle],
    ["/style.css?effront-tailwind&direct", generatedWithDirect],
    ["/style.css?direct&effront-tailwind", directWithGenerated],
  ])("resolves %s as an absolute virtual stylesheet", async (request, expected) => {
    const plugin = await integration();
    expect(plugin.resolve(request)).toBe(expected);
  });

  test("does not resolve an unrelated stylesheet as a generated module", async () => {
    const plugin = await integration();
    expect(plugin.resolve("/unrelated.css")).toBeUndefined();
  });

  test.each([generatedStyle, generatedWithDirect, directWithGenerated])(
    "loads the same generated CSS for %s",
    async (id) => {
      const plugin = await integration();
      const generated = plugin.load(generatedStyle);
      expect(generated).toContain("tailwindcss/index.css");
      expect(plugin.load(id)).toBe(generated);
    },
  );

  test("does not load unrelated CSS", async () => {
    const plugin = await integration();
    expect(plugin.load("/unrelated.css")).toBeUndefined();
  });
});

describe("client boundary stylesheet imports", () => {
  test.each(['"use client";', "'use client';", '/* boundary */\n"use client"\n'])(
    "preserves the directive and original lines: %s",
    async (directive) => {
      const plugin = await integration();
      const source = `${directive}\nexport const Button = () => null;`;
      expect(plugin.transform(source)).toMatchObject({
        code: `${source}\nimport "${virtualStyle}";\n`,
      });
    },
  );

  test("imports an explicit CSS entry relative to the application root", async () => {
    const plugin = await integration({ stylesheet: "./src/theme.css" });
    const source = '"use client";\nexport function Shell() {}';
    const stylesheet = normalizePath(path.resolve(root, "src/theme.css"));
    expect(plugin.transform(source)).toMatchObject({
      code: `${source}\nimport ${JSON.stringify(stylesheet)};\n`,
    });
  });

  test.each([
    '"use server";\nexport const action = 1;',
    'export const text = "use client";',
    '/* "use client" */\nexport const data = 1;',
  ])("does not change modules without a client directive", async (source) => {
    const plugin = await integration();
    expect(plugin.transform(source)).toBeUndefined();
  });

  test.each([
    "/app/style.css",
    "/app/client.tsx?raw",
    "/app/client.tsx?url",
    "/app/client.tsx?worker",
    "/app/client.tsx?sharedworker",
  ])("does not transform excluded Vite request %s", async (id) => {
    const plugin = await integration();
    expect(plugin.transform('"use client";', id)).toBeUndefined();
  });
});
