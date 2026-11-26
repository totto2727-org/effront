import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { effront } from "@effront/vite";
import react from "@vitejs/plugin-react";
import { Effect, Path } from "effect";
import type { DevEnvironment, ViteDevServer } from "vite";
import { assert, describe, expect } from "vitest";

import { exampleRoot, fixtureDirectory, quietServer, startVite } from "./vite-fixture.ts";

const memoSentinel = "react.memo_cache_sentinel";
const counter = "/src/components/counter.tsx";

const openCompiler = Effect.fnUntraced(function* (compiler: boolean) {
  const path = yield* Path.Path;
  const root = yield* exampleRoot;
  const directory = yield* fixtureDirectory("compiler-test-");
  return yield* startVite({
    cacheDir: path.join(directory, compiler ? "compiled" : "uncompiled"),
    configFile: false,
    plugins: compiler ? effront() : [react({ compiler: false })],
    root,
    server: {
      ...quietServer,
      middlewareMode: true,
    },
  });
}, Effect.provide(NodeServices.layer));

const environment = (server: ViteDevServer, name: string): DevEnvironment => {
  const runtime = server.environments[name];
  assert.isDefined(runtime);
  return runtime;
};

const source = (runtime: DevEnvironment, moduleId: string): Effect.Effect<string | undefined> =>
  Effect.promise(async () => {
    const result = await runtime.transformRequest(moduleId);
    return result?.code;
  });

const resolveReact = Effect.fnUntraced(function* (runtime: DevEnvironment) {
  const path = yield* Path.Path;
  const importer = yield* path.fromFileUrl(
    new URL("../../core/src/application/definition.tsx", import.meta.url),
  );
  const resolved = yield* Effect.promise(async () =>
    runtime.pluginContainer.resolveId("react", importer),
  );
  return resolved?.id;
}, Effect.provide(NodeServices.layer));

// Exercise the real Vite module pipeline. The browser suite runs the artifacts in workerd.
describe("default native React Compiler", () => {
  live("memoizes the real example Counter by default, unlike a compiler-disabled control", () =>
    Effect.gen(function* () {
      const compiled = yield* openCompiler(true);
      const uncompiled = yield* openCompiler(false);
      const enabled = yield* source(environment(compiled, "client"), counter);
      const disabled = yield* source(environment(uncompiled, "client"), counter);

      expect(enabled).toContain("compiler-runtime");
      expect(enabled).toContain(memoSentinel);
      expect(enabled).toMatch(/\$\[\d+\]/u);
      expect(disabled).toContain("Count:");
      const emittedMarkers = ["compiler-runtime", memoSentinel].filter((marker) =>
        (disabled ?? "").includes(marker),
      );
      expect(emittedMarkers).toStrictEqual([]);
    }),
  );
});

describe("portable React runtime graphs", () => {
  live("configures independent client, SSR, and react-server requirements", () =>
    Effect.gen(function* () {
      const compiled = yield* openCompiler(true);
      const client = environment(compiled, "client");
      const ssr = environment(compiled, "ssr");
      const rsc = environment(compiled, "rsc");
      expect(compiled.config.plugins.some(({ name }) => name.includes("cloudflare"))).toBe(false);
      expect([client.config.consumer, ssr.config.consumer, rsc.config.consumer]).toStrictEqual([
        "client",
        "server",
        "server",
      ]);
      const usesReactServer = [client, ssr, rsc].map((graph) =>
        graph.config.resolve.conditions.includes("react-server"),
      );
      expect(usesReactServer).toStrictEqual([false, false, true]);
    }),
  );

  live("keeps SSR and RSC output outside client memoization", () =>
    Effect.gen(function* () {
      const compiled = yield* openCompiler(true);
      const ssr = environment(compiled, "ssr");
      const rsc = environment(compiled, "rsc");
      const serverRendered = yield* source(ssr, counter);
      const serverReference = yield* source(rsc, counter);
      const serverApplication = yield* source(rsc, "/src/entry.effront.tsx");
      expect(serverRendered).toContain("Count:");
      expect(serverReference).toContain("registerClientReference");
      expect(serverApplication).toContain("React Server Components on Workers");
      [serverRendered, serverReference, serverApplication].forEach((code) => {
        expect(code).not.toContain("compiler-runtime");
        expect(code).not.toContain(memoSentinel);
      });
    }),
  );
});

describe("linked React package resolution by Vite runtime", () => {
  live("resolves a linked React-dependent package for each runtime graph", () =>
    Effect.gen(function* () {
      const compiled = yield* openCompiler(true);
      const client = yield* resolveReact(environment(compiled, "client"));
      const ssr = yield* resolveReact(environment(compiled, "ssr"));
      const rsc = yield* resolveReact(environment(compiled, "rsc"));

      expect(client).toContain("/deps/react.js");
      expect(ssr).toContain("/deps_ssr/react.js");
      expect(rsc).toContain("/deps_rsc/react.js");
      expect(rsc).not.toBe(ssr);
    }),
  );
});
