// oxlint-disable-next-line rules/no-node-imports -- The scoped Node server must receive Vite's real middleware as its native request handler.
import { createServer as createHttpServer } from "node:http";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { effront } from "@effront/vite";
import { Data, Effect, Path, Predicate, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpServer } from "effect/http";
import { assert, describe, expect } from "vitest";
import type { DevEnvironment, ViteDevServer } from "vite";

import { exampleRoot, fixtureDirectory, quietServer, startVite } from "./vite-fixture.ts";

const sourceMapVersion = 3;
const SourceMap = Schema.Struct({
  mappings: Schema.NonEmptyString,
  sources: Schema.Array(Schema.String),
  version: Schema.Literal(sourceMapVersion),
});
// oxlint-disable-next-line rules/prefer-non-unknown-decode -- The Vite endpoint returns an untrusted HTTP JSON payload.
const decodeSourceMap = Schema.decodeUnknownEffect(SourceMap);

const serveViteMaps = Effect.gen(function* () {
  const path = yield* Path.Path;
  const root = yield* exampleRoot;
  const directory = yield* fixtureDirectory("source-map-test-");
  const server = yield* startVite({
    cacheDir: path.join(directory, "cache"),
    configFile: false,
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: effront(),
    root,
    server: { ...quietServer, middlewareMode: true },
  });
  const http = yield* NodeHttpServer.make(() => createHttpServer(server.middlewares), {
    host: "127.0.0.1",
    port: 0,
  });
  const origin = HttpServer.formatAddress(http.address);
  return { origin, server };
}).pipe(Effect.provide(NodeServices.layer));

interface MapCase {
  environment: "client" | "rsc";
  name: "Client" | "Server";
  path: string;
}

class MissingViteModule extends Data.TaggedError("MissingViteModule")<{ path: string }> {}

const lookupModuleId = Effect.fnUntraced(function* (graph: DevEnvironment, path: string) {
  yield* Effect.promise(async () => graph.transformRequest(path));
  const module = yield* Effect.promise(async () => graph.moduleGraph.getModuleByUrl(path));
  const id = module?.id;
  return Predicate.isString(id) ? id : yield* new MissingViteModule({ path });
});

const sourceMapUrl = Effect.fnUntraced(function* (
  { origin, server }: { origin: string; server: ViteDevServer },
  fixture: MapCase,
) {
  const graph = server.environments[fixture.environment];
  assert.isDefined(graph);
  const id = yield* lookupModuleId(graph, fixture.path);
  const filename = fixture.name === "Client" ? new URL(fixture.path, origin).href : id;
  const endpoint = new URL("/__vite_rsc_findSourceMapURL", origin);
  endpoint.searchParams.set("filename", filename);
  endpoint.searchParams.set("environmentName", fixture.name);
  return endpoint;
});

describe("development source maps for RSC and client graphs", () => {
  live.each([
    { environment: "rsc", name: "Server", path: "/src/entry.effront.tsx" },
    { environment: "client", name: "Client", path: "/src/components/counter.tsx" },
  ] satisfies MapCase[])("serves the $name transform map through Vite's RSC endpoint", (fixture) =>
    Effect.gen(function* () {
      const vite = yield* serveViteMaps;
      const endpoint = yield* sourceMapUrl(vite, fixture);
      const response = yield* HttpClient.get(endpoint).pipe(Effect.provide(FetchHttpClient.layer));
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      const map = yield* response.json.pipe(Effect.flatMap(decodeSourceMap));
      expect(map.sources).toStrictEqual([fixture.path]);
    }),
  );
});
