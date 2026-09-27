import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizePath, resolveConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { effrontTailwind } from "./index";

const root = fileURLToPath(new URL("../../../examples/basic/", import.meta.url));

async function integration(stylesheet?: string) {
  const config = await resolveConfig(
    {
      root,
      configFile: false,
      plugins: effrontTailwind(stylesheet === undefined ? {} : { stylesheet }),
    },
    "build",
  );
  const plugin = config.plugins.find((entry) => entry.name === "effront:tailwind")!;
  const transform = plugin.transform!;
  const load = plugin.load!;
  const resolveId = plugin.resolveId!;
  return {
    config,
    transform: (code: string, id = "/app/client.tsx") =>
      Reflect.apply(typeof transform === "function" ? transform : transform.handler, {}, [
        code,
        id,
      ]),
    load: (id: string) => Reflect.apply(typeof load === "function" ? load : load.handler, {}, [id]),
    resolve: (id: string) =>
      Reflect.apply(typeof resolveId === "function" ? resolveId : resolveId.handler, {}, [id]),
  };
}

describe("Effront Tailwind", () => {
  it("includes the official plugin and generates CSS without a disk stylesheet", async () => {
    const plugin = await integration();
    expect(plugin.config.plugins.map((entry) => entry.name)).toContain(
      "@tailwindcss/vite:generate:build",
    );
    const id = plugin.resolve("virtual:effront/tailwind.css");
    expect(id).toBe(normalizePath(resolve(root, "style.css")) + "?effront-tailwind");
    expect(plugin.load(id)).toContain("tailwindcss/index.css");
    expect(plugin.load(`${id}&direct`)).toBe(plugin.load(id));
    const directId = id.replace("?effront-tailwind", "?direct&effront-tailwind");
    expect(plugin.load(directId)).toBe(plugin.load(id));
    expect(plugin.resolve("/style.css?direct&effront-tailwind")).toBe(directId);
    expect(plugin.resolve("/style.css?effront-tailwind")).toBe(id);
    expect(plugin.resolve("/style.css?effront-tailwind&direct")).toBe(`${id}&direct`);
    expect(plugin.load("/unrelated.css")).toBeUndefined();
    expect(plugin.resolve("/unrelated.css")).toBeUndefined();
  });

  it.each(['"use client";', "'use client';", '/* boundary */\n"use client"\n'])(
    "preserves the directive and original lines: %s",
    async (directive) => {
      const plugin = await integration();
      const source = `${directive}\nexport const Button = () => null;`;
      expect(plugin.transform(source).code).toBe(
        `${source}\nimport "virtual:effront/tailwind.css";\n`,
      );
    },
  );

  it("imports an explicit CSS entry relative to the application root", async () => {
    const plugin = await integration("./src/theme.css");
    const source = '"use client";\nexport function Shell() {}';
    expect(plugin.transform(source).code).toContain(
      JSON.stringify(normalizePath(resolve(root, "src/theme.css"))),
    );
    expect(plugin.transform(source).code).not.toContain("virtual:effront/tailwind.css");
  });

  it.each([
    '"use server";\nexport const action = 1;',
    'export const text = "use client";',
    '/* "use client" */\nexport const data = 1;',
  ])("does not change modules without a client directive", async (source) => {
    const plugin = await integration();
    expect(plugin.transform(source)).toBeUndefined();
  });

  it("does not transform CSS or raw assets", async () => {
    const plugin = await integration();
    expect(plugin.transform('"use client";', "/app/style.css")).toBeUndefined();
    expect(plugin.transform('"use client";', "/app/client.tsx?raw")).toBeUndefined();
  });

  it("rejects an empty explicit stylesheet path", () => {
    expect(() => effrontTailwind({ stylesheet: "" })).toThrow(TypeError);
  });
});
