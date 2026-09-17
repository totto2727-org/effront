# Effront Alchemy adapter

This private experimental package connects Effront's native Effect HTTP application to `alchemy@2.0.0-beta.77` Cloudflare Workers.
Its public entry points are `@effront/alchemy/cloudflare` and `@effront/alchemy/cloudflare/vite`.

## Native construction

Declare `Cloudflare.Worker` directly and bind resources in its construction Effect.
Provide `Cloudflare.KV.ReadWriteNamespaceBinding` around construction when using `Cloudflare.KV.ReadWriteNamespace`.
Pass a deferred application import to `makeApplicationHttpEffect` so Node-side infrastructure evaluation does not load the RSC application.

```ts
Effect.gen(function* () {
  const kv = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
  const fetch = yield* makeApplicationHttpEffect(() =>
    import("./entry.effront").then((module) => module.default),
  ).pipe(Effect.provideService(CacheClient, kv));
  return { fetch: fetch.pipe(Effect.orDie) };
}).pipe(Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding));
```

`applicationHttpEffect(loader, { context })` is the equivalent direct handler API when the constructed capability context is already available.
Both helpers preserve typed application failures so the application can handle them at its HTTP boundary.
Alchemy's native HTTP handler type accepts a narrower error union, so map remaining application failures before returning the handler from Worker construction.

The Workers example exposes the native `ReadWriteNamespaceClient` through its `CacheClient` Effect service and performs KV operations in the request-owned `HostLive` layer.
This service is a meaningful capability boundary, but its client type and effects still depend on Alchemy.
Only the resulting `Host` label and greeting are provider-independent data; this example is not a purely host-neutral application.

The helper captures references, not service lifetimes.
Application layers are acquired per request, while Alchemy's official bridge owns request scope transfer to the response stream.
Construction-time HTTP services, scope, layer memo map, Alchemy RuntimeContext, Worker self, generic Self, Cloudflare environment, raw Request, Worker environment, and execution context are omitted from captured context.
Live request context overrides captured application capabilities.
Other explicitly required services remain application dependencies, including named container application capabilities.

## Vite graphs

Configure `effrontAlchemy({ worker: "./src/entry.workers.ts", stack: { name: "example", stage: "local" } })` and declare the native Worker with `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }`.
The plugin owns the generated RSC bridge, Effront's browser and SSR integration, and the runtime-phase compilation flag.
SSR output defaults to a child directory inside the RSC Worker artifact so standalone workerd can load it.
Explicit output directories are preserved and must still be packaged together by the host.
Alchemy's injected `ALCHEMY_STACK_NAME` and `ALCHEMY_STAGE` runtime bindings override the configured standalone identity.

The plugin does not start a host.
Alchemy injects its own host during official CLI orchestration.
From `examples/workers/`, `examples/markdown/`, or `app/docs/`, run `vp run dev`, which invokes `vp exec alchemy dev`.
The native Worker props own their development ports: 1337, 1338, and 1339 respectively.
Application Vite configs register only the Effront integration and applicable application plugins, never a manual `@alchemy.run/cloudflare-runtime` host or an injection-environment guard.
The independent `tests/e2e-alchemy/` package owns the separate runtime host used for its standalone local acceptance.

### Pinned development projection

The beta.77 Cloudflare barrels also export Node-only deployment providers, which cannot execute inside workerd's Vite module runner.
During dependency optimization only, the adapter projects a narrow runtime export surface from the real installed Alchemy modules and applies Alchemy's official purity transform.
It does not copy Alchemy implementations or change Node-side construction imports.
The projection fails on an unsupported Alchemy version or missing internal module.

Supported projected exports are `Worker`, Worker environment and execution context services, raw `Request`, `makeWorkerBridge`, `CloudflareEnvironment`, and the KV namespace plus read, write, and read-write native binding services.
The Workers barrel additionally exposes `fromExecutionContext` and `deferredExecutionContext`.
Deployment providers, HTTP-backed KV services, and other Cloudflare resources are outside this experimental development adapter's supported projection.

## Local verification boundary

The test-owned standalone Vite/workerd host does not require cloud resource creation.
The standard Alchemy CLI Cloudflare provider and its local sidecar still install profile/authentication layers, even with `localState()`.
Standalone local acceptance is not proof that the standard Alchemy CLI is authentication-free.
No package publication or cloud deployment is included in this experiment.
