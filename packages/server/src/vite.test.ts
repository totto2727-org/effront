import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { effront } from "@effront/vite";
import { Effect, FileSystem, Path } from "effect";
import { resolveConfig } from "vite";
import type { PluginOption, ResolvedConfig, UserConfig } from "vite";
import { afterEach, describe, expect, test, vi } from "vitest";

import { effrontServer } from "./vite.ts";

const resolveHost = Effect.fnUntraced(function* (options: UserConfig, command: "serve" | "build") {
  const path = yield* Path.Path;
  const location = new URL("../../../tests/e2e-server/fixtures/node/", import.meta.url);
  const root = yield* path.fromFileUrl(location);
  const mode = command === "build" ? "production" : "development";
  const config = yield* Effect.tryPromise(async () =>
    resolveConfig(
      {
        configFile: false,
        logLevel: "silent",
        plugins: [effront(), effrontServer()],
        root,
        ...options,
      },
      command,
      mode,
      mode,
    ),
  );
  return { config, path, root };
}, Effect.provide(NodeServices.layer));

const resolveBuild = resolveHost({}, "build");

const restoreEnv = (): void => {
  vi.unstubAllEnvs();
};

const unsetEnv = (name: string): void => {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest needs explicit undefined to unset the variable and restore it in the hook.
  vi.stubEnv(name, undefined);
};

describe("native server build configuration", () => {
  live("builds distinct native handler and startup entries", () =>
    Effect.gen(function* () {
      const { config } = yield* resolveBuild;
      const build = config.environments["rsc"]?.build.rolldownOptions;
      expect(build?.input).toStrictEqual({
        index: "./src/entry.rsc.ts",
        server: "./src/entry.server.ts",
      });
      expect(build?.output).toMatchObject({ entryFileNames: "[name].js" });
    }),
  );

  live("preserves RSC conditions, SSR runtime transforms, and Effect deduplication", () =>
    Effect.gen(function* () {
      const { config } = yield* resolveBuild;
      const { rsc, ssr } = config.environments;
      const serverConditions = [rsc?.resolve, ssr?.resolve, config.resolve];
      expect(
        serverConditions.map((resolve) => resolve?.conditions.includes("react-server")),
      ).toStrictEqual([true, false, false]);
      expect(rsc?.resolve.noExternal).toContain("@effront/core");
      expect(ssr?.resolve.noExternal).toContain("@effront/core");
      expect(config.resolve.dedupe).toContain("effect");
      expect(config.plugins.filter(({ name }) => name === "rsc")).toHaveLength(1);
    }),
  );

  live("omits the production startup and forced NODE_ENV in development", () =>
    Effect.gen(function* () {
      const { config } = yield* resolveHost({}, "serve");
      const { rsc, ssr } = config.environments;
      expect(rsc?.build.rolldownOptions.input).toStrictEqual({ index: "./src/entry.rsc.ts" });
      expect(rsc?.define?.["process.env.NODE_ENV"]).toBeUndefined();
      expect(ssr?.define?.["process.env.NODE_ENV"]).toBeUndefined();
    }),
  );
});

const serverEnv = (config: ResolvedConfig): unknown[][] =>
  [config.environments["rsc"], config.environments["ssr"]].map((environment) => {
    const settings: unknown[] = [
      environment?.define?.["process.env.NODE_ENV"],
      environment?.define?.["global.process.env.NODE_ENV"],
      environment?.define?.["globalThis.process.env.NODE_ENV"],
      environment?.define?.["process.env.APPLICATION_FLAG"],
      environment?.define?.["process.env"],
      environment?.define?.["process.env.PORT"],
      environment?.keepProcessEnv,
    ];
    return settings;
  });

describe("resolved React environment in native server builds", () => {
  afterEach(restoreEnv);

  live.each(["production", "development", "test"])(
    "pins the resolved %s React mode and leaves other variables available",
    (nodeEnv) =>
      Effect.gen(function* () {
        vi.stubEnv("NODE_ENV", nodeEnv);
        const flag = { define: { "process.env.APPLICATION_FLAG": '"retained"' } };
        const { config } = yield* resolveHost(
          { environments: { rsc: flag, ssr: flag }, mode: "staging" },
          "build",
        );
        const expected = JSON.stringify(config.isProduction ? "production" : "development");
        const defines = [expected, expected, expected, '"retained"', undefined, undefined, true];
        expect(config.isProduction).toBe(nodeEnv === "production");
        expect(serverEnv(config)).toStrictEqual([defines, defines]);
      }),
  );

  live("honors an explicit client NODE_ENV define in both server graphs", () =>
    Effect.gen(function* () {
      vi.stubEnv("NODE_ENV", "production");
      const { config } = yield* resolveHost(
        {
          environments: {
            client: { define: { "process.env.NODE_ENV": '"development"' } },
            rsc: { define: { "process.env.NODE_ENV": '"production"' } },
          },
        },
        "build",
      );
      const clientMode: unknown = config.environments["client"]?.define?.["process.env.NODE_ENV"];
      const { rsc, ssr } = config.environments;
      expect(config.isProduction).toBe(true);
      expect(rsc?.define?.["process.env.NODE_ENV"]).toBe(clientMode);
      expect(ssr?.define?.["process.env.NODE_ENV"]).toBe(clientMode);
    }),
  );
});

const localEnv = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmp = yield* path.fromFileUrl(new URL("../../../tmp/", import.meta.url));
  yield* fs.makeDirectory(tmp, { recursive: true });
  const envDir = yield* fs.makeTempDirectoryScoped({ directory: tmp, prefix: "server-vite-env-" });
  yield* fs.writeFileString(path.join(envDir, ".env"), "NODE_ENV=development\n");
  return envDir;
}).pipe(Effect.provide(NodeServices.layer));

describe("native server mode overrides", () => {
  afterEach(restoreEnv);

  live("uses development mode when .env overrides the default production build", () =>
    Effect.gen(function* () {
      unsetEnv("NODE_ENV");
      unsetEnv("VITE_USER_NODE_ENV");
      const envDir = yield* localEnv;
      const { config } = yield* resolveHost({ envDir }, "build");
      const { rsc, ssr } = config.environments;
      expect(config.mode).toBe("production");
      expect(config.isProduction).toBe(false);
      expect(rsc?.define?.["process.env.NODE_ENV"]).toBe('"development"');
      expect(ssr?.define?.["process.env.NODE_ENV"]).toBe('"development"');
    }),
  );
});

describe("custom native server build output", () => {
  live("retains custom RSC, SSR and client paths with extra host entries", () =>
    Effect.gen(function* () {
      const { config, path, root } = yield* resolveHost(
        {
          environments: {
            client: { build: { outDir: "output/client" } },
            rsc: {
              build: {
                outDir: "output/rsc",
                rolldownOptions: { input: { other: "./custom/other.ts" } },
              },
            },
            ssr: { build: { outDir: "output/ssr" } },
          },
          plugins: [
            effront(),
            effrontServer({ rsc: "./custom/handler.ts", server: "./custom/main.ts" }),
          ],
        },
        "build",
      );
      const { client, rsc, ssr } = config.environments;
      expect(rsc?.build.rolldownOptions.input).toStrictEqual({
        index: "./custom/handler.ts",
        other: "./custom/other.ts",
        server: "./custom/main.ts",
      });
      const directories = ["rsc", "ssr", "client"].map((name) => path.join(root, "output", name));
      expect([rsc?.build.outDir, ssr?.build.outDir, client?.build.outDir]).toStrictEqual(
        directories,
      );
    }),
  );
});

const invalidPluginOrder = [
  { case: "missing portable plugin", plugins: (): PluginOption[] => [effrontServer()] },
  { case: "reversed plugin order", plugins: (): PluginOption[] => [effrontServer(), effront()] },
];

describe("native server plugin validation", () => {
  live.each(invalidPluginOrder)("rejects $case", ({ plugins }) =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(resolveHost({ plugins: plugins() }, "build"));
      expect(failure.cause).toHaveProperty("message", "Register effront() before effrontServer().");
    }),
  );

  test.each([{ rsc: "" }, { server: "" }])("rejects empty entry options %j", (options) => {
    expect(() => effrontServer(options)).toThrow(TypeError);
  });
});
