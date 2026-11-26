// oxlint-disable-next-line rules/no-node-imports -- The real Vite build must mark the Node host's built-ins as external.
import { builtinModules } from "node:module";
// oxlint-disable-next-line rules/no-node-imports -- The fixture build uses a path derived from this test's module URL.
import { fileURLToPath } from "node:url";

import * as Cloudflare from "alchemy/Cloudflare";
import { Data, Predicate } from "effect";
import { build } from "vite";
import type { Plugin } from "vite";
import { assert, describe, expect, test } from "vite-plus/test";

import { alchemyRuntimeProjection } from "./runtime-projection.ts";

class InvalidProjectionFixture extends Data.TaggedError("InvalidProjectionFixture")<{
  message: string;
}> {}

interface ProjectionHooks {
  applies: (name: string) => unknown;
  load: (id: string) => unknown;
  plugin: Plugin;
  resolve: (id: string) => unknown;
}

const invokeHook = (hook: object, args: unknown[]): unknown => {
  if (!Predicate.isFunction(hook)) {
    throw new InvalidProjectionFixture({ message: "Expected a callable Vite hook." });
  }
  const result: unknown = Reflect.apply(hook, {}, args);
  return result;
};

const hooks = (): ProjectionHooks => {
  const plugin = alchemyRuntimeProjection();
  const { applyToEnvironment, load, resolveId } = plugin;
  assert.isDefined(applyToEnvironment);
  assert.isDefined(load);
  assert.isDefined(resolveId);
  const loadHandler = "handler" in load ? load.handler : load;
  const resolveHandler = "handler" in resolveId ? resolveId.handler : resolveId;
  return {
    applies: (name) => invokeHook(applyToEnvironment, [{ name }]),
    load: (id) => invokeHook(loadHandler, [id]),
    plugin,
    resolve: (id) => invokeHook(resolveHandler, [id]),
  };
};

const expectText = (value: unknown): string => {
  if (Predicate.isString(value)) {
    return value;
  }
  throw new InvalidProjectionFixture({ message: "Expected the Vite hook to return text." });
};

const exportsOf = (code: string): string[] => {
  const clause = /export \{(?<bindings>[^}]+)\};\s*$/u.exec(code)?.groups?.["bindings"] ?? "";
  if (!clause) {
    throw new InvalidProjectionFixture({ message: "Expected an ES module export clause." });
  }
  return clause.split(",").flatMap((entry) => {
    const name =
      entry
        .trim()
        .split(/\s+as\s+/u)
        .at(-1) ?? "";
    return name ? [name] : [];
  });
};

const leakedCode = (code: string): string[] =>
  ["downloadedBinPath", "import.meta.resolve", "createViteServer"].filter((part) =>
    code.includes(part),
  );

const buildWorker = async (): Promise<{ code: string; names: string[] }> => {
  const entry = "\0effront-test:alchemy-worker";
  const result = await build({
    build: {
      minify: false,
      rolldownOptions: {
        external: (id) =>
          id === "effect" ||
          id.startsWith("effect/") ||
          id.startsWith("node:") ||
          id.startsWith("cloudflare:") ||
          builtinModules.includes(id),
        input: entry,
      },
      ssr: true,
      write: false,
    },
    configFile: false,
    define: { "globalThis.__ALCHEMY_RUNTIME__": "true" },
    logLevel: "silent",
    plugins: [
      alchemyRuntimeProjection(),
      {
        load: (id) => (id === entry ? 'export * from "alchemy/Cloudflare/Workers";' : undefined),
        name: "effront-test:alchemy-worker",
        resolveId: (id) => (id === entry ? id : undefined),
      },
    ],
    root: fileURLToPath(new URL("../../", import.meta.url)),
    ssr: { noExternal: true },
  });
  if ("on" in result) {
    throw new InvalidProjectionFixture({ message: "Unexpected test build watcher." });
  }
  const output = Array.isArray(result) ? result.flatMap((value) => value.output) : result.output;
  const chunks = output.filter((value) => value.type === "chunk");
  const entryChunk = chunks.find((value) => value.isEntry);
  assert.isDefined(entryChunk);
  return { code: chunks.map((value) => value.code).join("\n"), names: exportsOf(entryChunk.code) };
};

describe("deployment exports from Alchemy", () => {
  test("leaves deployment exports available to the real Node tooling", () => {
    expect(Cloudflare.providers).toBeTypeOf("function");
    expect(Cloudflare.KV.NamespaceProvider).toBeTypeOf("function");
  });
});

describe("subtractive Alchemy runtime exports", () => {
  test("keeps non-KV capabilities and runtime providers while removing deployment code", async () => {
    const { resolve, load } = hooks();
    const id = expectText(await resolve("alchemy/Cloudflare"));
    const first = load(id);
    expect(load(id)).toBe(first);
    const code = expectText(await first);
    const names = exportsOf(code);
    expect(names).toStrictEqual(
      expect.arrayContaining([
        "Worker",
        "KV",
        "R2",
        "D1",
        "Queues",
        "Workflows",
        "Vectorize",
        "AI",
        "WorkerConfigProvider",
        "BrowserLocal",
        "makeWorkerBridge",
      ]),
    );
    expect(["providers", "ContainerProvider"].filter((name) => names.includes(name))).toStrictEqual(
      [],
    );
    expect(leakedCode(code)).toStrictEqual([]);
  }, 30_000);

  test("preserves R2 runtime and HTTP APIs without enumerating allowed capabilities", async () => {
    const { resolve, load } = hooks();
    const id = expectText(await resolve("alchemy/Cloudflare/R2"));
    const code = expectText(await load(id));
    const names = exportsOf(code);
    expect(names).toStrictEqual(
      expect.arrayContaining([
        "Bucket",
        "ReadWriteBucket",
        "ReadWriteBucketBinding",
        "ReadWriteBucketHttp",
      ]),
    );
    expect(names).not.toContain("BucketProvider");
    expect(names).not.toContain("ProviderLocal");
  }, 30_000);
});

describe("native Worker module graph", () => {
  test("builds the Worker without bundling deployment tooling", async () => {
    const { code, names } = await buildWorker();
    expect(names).toStrictEqual(
      expect.arrayContaining(["Worker", "makeWorkerBridge", "WorkerConfigProvider"]),
    );
    expect(leakedCode(code)).toStrictEqual([]);
  }, 30_000);

  test("runs in server graphs for both commands without modifying the optimizer", async () => {
    const { applies, plugin, resolve, load } = hooks();
    expect([plugin.apply, plugin.config, plugin.configEnvironment]).toStrictEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect([applies("client"), applies("rsc"), applies("ssr")]).toStrictEqual([false, true, true]);
    await expect(resolve("other-package")).resolves.toBeUndefined();
    expect(load("/application/worker.ts")).toBeUndefined();
    await expect(resolve("alchemy/Cloudflare/StateStore")).rejects.toThrow("deployment-only");
  });
});
