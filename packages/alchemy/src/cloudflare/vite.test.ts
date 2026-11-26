import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { effront } from "@effront/vite";
import { Data, Effect, Path, Predicate } from "effect";
import { normalizePath, resolveConfig } from "vite";
import type { Plugin, ResolvedConfig, UserConfig } from "vite";
import { assert, describe, expect, test } from "vite-plus/test";

import { effrontAlchemy } from "./vite.ts";

const loaderName = "effront:alchemy-application-loader";
const bridgeName = "effront:alchemy-cloudflare-bridge";
const entryId = "virtual:effront/alchemy/cloudflare/entry";
const portableEntry = "effront:application-entry";

class InvalidViteFixture extends Data.TaggedError("InvalidViteFixture")<{
  cause: unknown;
  message: string;
}> {}

const resolveConfiguredFixture = Effect.fnUntraced(function* (
  options: UserConfig,
  mode: "serve" | "build",
) {
  const path = yield* Path.Path;
  const root = yield* path.fromFileUrl(new URL("../../../../examples/basic/", import.meta.url));
  const config = yield* Effect.tryPromise({
    catch: (cause) =>
      new InvalidViteFixture({
        cause,
        message: "Vite configuration resolution failed.",
      }),
    try: async () =>
      resolveConfig(
        { configFile: false, plugins: [effront(), effrontAlchemy()], root, ...options },
        mode,
      ),
  });
  return { config, path, root };
}, Effect.provide(NodeServices.layer));

const resolveFixture = (
  options: UserConfig = {},
  mode: "serve" | "build" = "build",
): ReturnType<typeof resolveConfiguredFixture> => resolveConfiguredFixture(options, mode);

const pluginFor = (config: ResolvedConfig, name: string): Plugin => {
  const plugin = config.plugins.find((value) => value.name === name);
  assert.isDefined(plugin);
  return plugin;
};

const invoke = (hook: object | undefined, args: unknown[]): unknown => {
  assert.isDefined(hook);
  const handle = "handler" in hook ? hook.handler : hook;
  if (!Predicate.isFunction(handle)) {
    throw new InvalidViteFixture({ cause: handle, message: "Expected a callable Vite hook." });
  }
  const output: unknown = Reflect.apply(handle, {}, args);
  return output;
};

const asText = (value: unknown): string => {
  if (!Predicate.isString(value)) {
    throw new InvalidViteFixture({
      cause: value,
      message: "Expected the Vite hook to return text.",
    });
  }
  return value;
};

const hasOptimizerOverride = (contribution: unknown): boolean => {
  if (
    !Predicate.hasProperty(contribution, "environments") ||
    !Predicate.isObject(contribution.environments)
  ) {
    throw new InvalidViteFixture({
      cause: contribution,
      message: "Expected the bridge to configure environments.",
    });
  }
  const environments: unknown[] = Object.values(contribution.environments);
  return environments.some((environment) => Predicate.hasProperty(environment, "optimizeDeps"));
};

describe("configured Alchemy application loader", () => {
  live("only loads statically in the RSC runtime environment", () =>
    Effect.gen(function* () {
      const { config } = yield* resolveFixture();
      const { applyToEnvironment } = pluginFor(config, loaderName);
      const environments = ["rsc", "ssr", "client"];
      expect(environments.map((name) => invoke(applyToEnvironment, [{ name }]))).toStrictEqual([
        true,
        false,
        false,
      ]);
    }),
  );

  live("uses the portable application alias and only replaces the adapter's loader", () =>
    Effect.gen(function* () {
      const { config, path, root } = yield* resolveFixture();
      const { load } = pluginFor(config, loaderName);
      const loader = yield* path.fromFileUrl(new URL("application-loader.ts", import.meta.url));
      const source = asText(invoke(load, [loader]));
      expect(source).toContain('import application from "@effront/core/application-entry"');
      expect(source).toContain("() => Promise.resolve(application)");
      expect(source).not.toContain("import(");
      const emittedLoader = loader.replace(/\.ts$/u, ".js");
      expect(invoke(load, [emittedLoader])).toBe(source);
      expect(invoke(load, [path.resolve(root, "src/application-loader.ts")])).toBeUndefined();
    }),
  );
});

describe("native Alchemy Worker graph", () => {
  live("configures the native bridge and runtime flag without installing a second host", () =>
    Effect.gen(function* () {
      const { config, path, root } = yield* resolveFixture();
      const { client, rsc, ssr } = config.environments;
      expect(config.define?.["globalThis.__ALCHEMY_RUNTIME__"]).toBe("true");
      expect(rsc?.build.rolldownOptions.input).toStrictEqual({ index: entryId });
      expect(ssr?.build.outDir).toBe(path.resolve(root, "dist/rsc/ssr"));
      expect(
        [rsc, ssr, client].map((environment) =>
          environment?.resolve.conditions.includes("react-server"),
        ),
      ).toStrictEqual([true, false, false]);
      expect(config.plugins.some(({ name }) => name.startsWith("cloudflare:"))).toBe(false);
    }),
  );

  live("generates its Worker entry and validates native stack bindings", () =>
    Effect.gen(function* () {
      const { config, path, root } = yield* resolveFixture();
      const { load, resolveId } = pluginFor(config, bridgeName);
      const bridge = asText(invoke(resolveId, [entryId]));
      const source = asText(invoke(load, [bridge]));
      const worker = normalizePath(path.resolve(root, "src/entry.workers.ts"));
      const required = [
        'import { env, WorkerEntrypoint } from "cloudflare:workers"',
        '"alchemy/Cloudflare/Workers"',
        JSON.stringify(worker),
        "name: env.ALCHEMY_STACK_NAME",
        "stage: env.ALCHEMY_STAGE",
        "Effront requires Alchemy runtime stack bindings",
      ];
      expect(required.filter((feature) => !source.includes(feature))).toStrictEqual([]);
      expect(source).not.toMatch(/configuredStack|async fetch/u);
    }),
  );
});

const resolveHost = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fixture = new URL("../../../../tests/e2e-alchemy/vite.config.ts", import.meta.url);
  const configFile = yield* path.fromFileUrl(fixture);
  return yield* Effect.promise(async () => resolveConfig({ configFile }, "serve"));
}).pipe(Effect.provide(NodeServices.layer));

describe("build host for Alchemy", () => {
  live("provides the bridge before the real Cloudflare host captures its entry", () =>
    Effect.gen(function* () {
      const config = yield* resolveHost;
      const entry = config.environments["rsc"]?.build.rolldownOptions.input;
      expect(JSON.stringify(entry)).toContain(entryId);
    }),
  );

  live("leaves dependency optimization to the host and consumer", () =>
    Effect.gen(function* () {
      const { config } = yield* resolveFixture(
        {
          environments: {
            rsc: { optimizeDeps: { include: ["consumer-dependency"], noDiscovery: true } },
            ssr: { optimizeDeps: { exclude: ["consumer-exclusion"] } },
          },
        },
        "serve",
      );
      const { rsc, ssr } = config.environments;
      expect(rsc?.optimizeDeps.noDiscovery).toBe(true);
      expect(rsc?.optimizeDeps.include).toContain("consumer-dependency");
      expect(ssr?.optimizeDeps.exclude).toContain("consumer-exclusion");
      const { config: configure } = pluginFor(config, bridgeName);
      const contribution = invoke(configure, [{}]);
      expect(hasOptimizerOverride(contribution)).toBe(false);
    }),
  );
});

describe("portable applications and Alchemy Worker configuration", () => {
  live("keeps portable application configuration separate from the native Worker", () =>
    Effect.gen(function* () {
      const { config, path, root } = yield* resolveFixture({
        plugins: [
          effront({ application: "./client/application.ts" }),
          effrontAlchemy({ worker: "./src/worker.ts" }),
        ],
      });
      expect(config.resolve.alias).toContainEqual({
        find: "@effront/core/application-entry",
        replacement: path.resolve(root, "client/application.ts"),
      });
      const nativeWorker = normalizePath(path.resolve(root, "src/worker.ts"));
      const { load } = pluginFor(config, bridgeName);
      expect(invoke(load, [`\0${entryId}`])).toContain(JSON.stringify(nativeWorker));
    }),
  );

  live("does not register portable React or RSC integrations by itself", () =>
    Effect.gen(function* () {
      const { config } = yield* resolveFixture({ plugins: effrontAlchemy() });
      expect(config.plugins.map(({ name }) => name)).not.toContain(portableEntry);
      expect(config.environments["rsc"]?.resolve.conditions).not.toContain("react-server");
      expect(config.resolve.alias).not.toContainEqual(
        expect.objectContaining({ find: "@effront/core/application-entry" }),
      );
    }),
  );

  test("rejects an empty explicit Worker entry", () => {
    expect(() => effrontAlchemy({ worker: "" })).toThrow(TypeError);
  });
});

describe("plugin ordering and output layout for Alchemy", () => {
  live("applies the native bridge once if the portable plugin comes first", () =>
    Effect.gen(function* () {
      const { config, path, root } = yield* resolveFixture({
        plugins: [effront({ rsc: "./src/custom-fetch.ts" }), effrontAlchemy()],
      });
      const { rsc, ssr } = config.environments;
      expect(rsc?.build.rolldownOptions.input).toStrictEqual({ index: entryId });
      expect(config.plugins.filter(({ name }) => name === portableEntry)).toHaveLength(1);
      expect(rsc?.resolve.conditions).toContain("react-server");
      expect(ssr?.build.outDir).toBe(path.resolve(root, "dist/rsc/ssr"));
    }),
  );

  live("rejects registration before the portable plugin", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        resolveFixture({ plugins: [effrontAlchemy(), effront({ rsc: "./src/custom-fetch.ts" })] }),
      );
      expect(failure.cause).toHaveProperty(
        "message",
        "Register effront() before effrontAlchemy() so the host receives the native Worker bridge.",
      );
    }),
  );

  live.each([
    {
      environments: { rsc: { build: { outDir: "custom/worker" } } },
      name: "nests SSR beneath an explicit RSC directory",
      ssr: "custom/worker/ssr",
    },
    {
      environments: { ssr: { build: { outDir: "custom/server-renderer" } } },
      name: "preserves an explicit SSR directory",
      ssr: "custom/server-renderer",
    },
  ])("$name", ({ environments, ssr }) =>
    Effect.gen(function* () {
      const { config, path, root } = yield* resolveFixture({
        environments,
        plugins: [effront(), effrontAlchemy({ worker: "./src/worker.ts" })],
      });
      expect(config.environments["ssr"]?.build.outDir).toBe(path.resolve(root, ssr));
    }),
  );
});
