import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";
import { describe, expect, it } from "vitest";
import { effront } from "./plugin";

const root = fileURLToPath(new URL("../../../examples/basic/", import.meta.url));

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
        plugins: effront({
          rsc: "./custom/host.ts",
          applications: [{ name: "app", entry: "./custom/app.tsx" }],
        }),
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

  it("rejects duplicate names rather than silently selecting an entry", () => {
    expect(() =>
      effront({
        applications: [
          { name: "app", entry: "first.tsx" },
          { name: "app", entry: "second.tsx" },
        ],
      }),
    ).toThrow("application names must be unique");
  });

  it("requires the host to select a Worker when several applications are configured", async () => {
    await expect(
      resolveConfig(
        {
          configFile: false,
          root,
          plugins: effront({
            applications: [
              { name: "first", entry: "first.tsx" },
              { name: "second", entry: "second.tsx" },
            ],
          }),
        },
        "build",
      ),
    ).rejects.toThrow("require a host to select a Worker");
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
      'import "effect/schema/SchemaJITCompiler/enable";\nimport application from "./entry.effront";',
    );
    expect(invoke("ssr", resolve(root, "src/entry.workers.ts"))).toBeUndefined();
    expect(invoke("rsc", resolve(root, "src/entry.effront.tsx"))).toBeUndefined();
  });
});
