import { fileURLToPath } from "node:url";
import * as KvNamespace from "@alchemy.run/cloudflare-runtime/core/bindings/kv-namespace/KvNamespace";
import * as Loopback from "@alchemy.run/cloudflare-runtime/core/bindings/Loopback";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { Effect } from "effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { defineConfig, type HotPayload, type Plugin } from "vite-plus";
import application from "../../examples/alchemy/vite.config";

const ledger = new Map<string, number>();
const pending = new Set<string>();
const updates: Array<{ environment: string; paths: string[] }> = [];
const reloads: Array<{
  environment: string;
  path: string | undefined;
  hash: string | undefined;
  triggeredBy: string | undefined;
}> = [];
const observe: Plugin = {
  name: "test:observe-real-workerd",
  enforce: "pre",
  configureServer(server) {
    // Observe only. Never send synthetic HMR, call optimizer.run, or restart Vite.
    for (const environment of Object.values(server.environments)) {
      const send = environment.hot.send.bind(environment.hot);
      environment.hot.send = (payload: HotPayload | string, data?: unknown) => {
        if (typeof payload === "string") {
          send(payload, data);
          return;
        }
        if (payload.type === "update") {
          updates.push({
            environment: environment.name,
            paths: payload.updates.map((update) => update.path),
          });
        }
        if (payload.type === "full-reload") {
          reloads.push({
            environment: environment.name,
            path: payload.path,
            hash: environment.depsOptimizer?.metadata.browserHash,
            triggeredBy: payload.triggeredBy,
          });
        }
        send(payload);
      };
    }
    server.middlewares.use((request, response, next) => {
      if (request.url !== "/__test/host") return next();
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          ledger: Object.fromEntries(ledger),
          pending: [...pending],
          reloads,
          updates,
          environments: Object.fromEntries(
            Object.values(server.environments).map((environment) => [
              environment.name,
              {
                hash: environment.depsOptimizer?.metadata.browserHash,
                optimized: Object.fromEntries(
                  Object.entries(environment.depsOptimizer?.metadata.optimized ?? {}).map(
                    ([id, info]) => [id, info.fileHash],
                  ),
                ),
                noDiscovery: environment.config.optimizeDeps.noDiscovery ?? false,
                include: environment.config.optimizeDeps.include ?? [],
              },
            ]),
          ),
        }),
      );
    });
  },
};

// Independent credential-free host, using public runtime bindings and the native adapter.
export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("./tmp/app/", import.meta.url)),
  cacheDir: fileURLToPath(new URL("./.vite-cache", import.meta.url)),
  environments: {
    // Seed only the initial dependency. Keep framework includes and discovery enabled.
    rsc: { optimizeDeps: { include: ["@effront-test/optimizer-a"] } },
  },
  plugins: [
    observe,
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      viteEnvironments: { entry: "rsc", children: ["ssr"] },
      worker: {
        name: "effront-alchemy-example-dev",
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-alchemy-example-dev"),
          Text.local("ALCHEMY_STAGE", "test"),
          KvNamespace.local({ binding: "Cache", id: "effront-example-dev-cache" }),
          Loopback.local({
            binding: "TestLedger",
            name: "effront-test-ledger",
            handler: Effect.gen(function* () {
              const request = yield* HttpServerRequest.HttpServerRequest;
              const id = new URL(request.url, "http://ledger.test").searchParams.get("id");
              if (!id || request.method !== "POST")
                return HttpServerResponse.empty({ status: 400 });
              ledger.set(id, (ledger.get(id) ?? 0) + 1);
              // A pending Node response is real external I/O from workerd's view.
              // A bare unresolved Promise inside an isolate is rejected as hung.
              pending.add(id);
              return yield* Effect.never.pipe(
                Effect.timeout("60 seconds"),
                Effect.ensuring(Effect.sync(() => pending.delete(id))),
                Effect.orDie,
              );
            }),
          }),
        ],
      },
    }),
  ],
});
