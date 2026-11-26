// oxlint-disable-next-line rules/no-node-imports -- Vite's entry paths are resolved on the current build host.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The Vite fixture path is relative to this test module.
import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";
import type { Plugin } from "vite";
import { assert, describe, expect, test } from "vitest";
import { effront } from "./plugin.ts";

const root = fileURLToPath(new URL("../../../examples/basic/", import.meta.url));

const transformEntry = (
  transform: NonNullable<Plugin["transform"]>,
  environment: string,
  id: string,
): unknown =>
  Reflect.apply(
    "handler" in transform ? transform.handler : transform,
    { environment: { name: environment } },
    ['import application from "./entry.effront";', id],
  );

describe("effront entry conventions", () => {
  test("uses entry.workers.ts and entry.effront.tsx without consumer configuration", async () => {
    const config = await resolveConfig({ configFile: false, plugins: effront(), root }, "build");

    expect(config.environments["rsc"]?.build.rolldownOptions.input).toStrictEqual({
      index: "./src/entry.workers.ts",
    });
    expect(config.resolve.alias).toContainEqual({
      find: "@effront/core/application-entry",
      replacement: path.resolve(root, "src/entry.effront.tsx"),
    });
  });

  test("preserves explicit host and application entry overrides relative to the consumer root", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        plugins: effront({ application: "./custom/app.tsx", rsc: "./custom/host.ts" }),
        root,
      },
      "build",
    );

    expect(config.environments["rsc"]?.build.rolldownOptions.input).toStrictEqual({
      index: "./custom/host.ts",
    });
    expect(config.resolve.alias).toContainEqual({
      find: "@effront/core/application-entry",
      replacement: path.resolve(root, "custom/app.tsx"),
    });
  });
});

describe("schema JIT host boundary", () => {
  test("registers Schema JIT before the RSC host entry without rewriting SSR or other modules", async () => {
    const config = await resolveConfig({ configFile: false, plugins: effront(), root }, "build");
    const transform = config.plugins.find(
      (entry) => entry.name === "effront:schema-jit",
    )?.transform;
    assert.isDefined(transform);
    const rscEntry = path.resolve(root, "src/entry.workers.ts");
    const application = path.resolve(root, "src/entry.effront.tsx");

    expect(transformEntry(transform, "rsc", rscEntry)).toBe(
      'import "effect/schema/SchemaJITCompiler/enable";\nimport application from "./entry.effront";',
    );
    expect(transformEntry(transform, "ssr", rscEntry)).toBeUndefined();
    expect(transformEntry(transform, "rsc", application)).toBeUndefined();
  });
});
