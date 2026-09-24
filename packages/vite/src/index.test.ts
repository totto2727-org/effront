import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";
import { describe, expect, it } from "vitest";
import { effront } from "./index";

const root = fileURLToPath(new URL("../../../examples/alchemy/", import.meta.url));

describe("Effront entry conventions", () => {
  it("uses entry.workers.ts and entry.effront.tsx without consumer configuration", async () => {
    const config = await resolveConfig({ configFile: false, root, plugins: effront() }, "build");

    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./src/entry.workers.ts",
    });
    expect(config.resolve.alias).toContainEqual({
      find: "@effront/core/application-entry",
      replacement: resolve(root, "src/entry.effront.tsx"),
    });
  });

  it("preserves explicit host and application entry overrides relative to the consumer root", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        plugins: effront({ rsc: "./custom/host.ts", application: "./custom/app.tsx" }),
      },
      "build",
    );

    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./custom/host.ts",
    });
    expect(config.resolve.alias).toContainEqual({
      find: "@effront/core/application-entry",
      replacement: resolve(root, "custom/app.tsx"),
    });
  });

  it("registers Schema JIT before the RSC host entry without rewriting SSR or other modules", async () => {
    const config = await resolveConfig({ configFile: false, root, plugins: effront() }, "build");
    const plugin = config.plugins.find((entry) => entry.name === "effront:schema-jit")!;
    const transform = plugin.transform!;
    const invoke = (environment: string, id: string) =>
      Reflect.apply(
        typeof transform === "function" ? transform : transform.handler,
        {
          environment: { name: environment },
        },
        ['import application from "./entry.effront";', id],
      );

    expect(invoke("rsc", resolve(root, "src/entry.workers.ts"))).toBe(
      'import "effect/unstable/schema/SchemaJITCompiler/enable";\nimport application from "./entry.effront";',
    );
    expect(invoke("ssr", resolve(root, "src/entry.workers.ts"))).toBeUndefined();
    expect(invoke("rsc", resolve(root, "src/entry.effront.tsx"))).toBeUndefined();
  });
});
