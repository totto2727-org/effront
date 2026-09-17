# Alchemy-native integration

This branch is an experimental Alchemy-first configuration of Effront.
`@effront/alchemy` is a private workspace package while the integration is evaluated, not an npm installation promise.
Existing package versions remain unchanged for this experiment; a release requires a separate version and publication decision.

## Boundaries

| Package                            | Responsibility                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `@effront/core`                    | Application definitions, request layers, routing, RSC and SSR                           |
| `@effront/core/http`               | Host-neutral native Effect HTTP handlers                                                |
| `@effront/vite`                    | React client/RSC/SSR compilation                                                        |
| `@effront/alchemy/cloudflare`      | Lazy application loading and construction-capability capture for native Alchemy Workers |
| `@effront/alchemy/cloudflare/vite` | Native Worker bridge, runtime compilation and colocated SSR output                      |

Core imports neither Alchemy nor Cloudflare.
`ApplicationDefinition<Services, Error, Requirements>` preserves the external requirements of its application layer instead of forcing the application to be closed before reaching its host.
`toHttpEffect(application)` returns an Effect HTTP handler whose requirements remain visible to the caller.
`makeHttpEffect(application)` captures application capability references during construction and returns a request handler.
Neither API runs an independent Effect runtime.

The Alchemy adapter lives under `packages/alchemy/src/cloudflare/`.
A future AWS integration can add a sibling provider directory and explicit package subpaths without introducing AWS dependencies into core or the Cloudflare entry.
Node/Bun can host the native HTTP effect or a Fetch boundary later, but this change does not claim those adapters exist.
The existing standalone `@effront/cloudflare` and Fetch wrapper remain as compatibility paths with their independent regression fixtures.

## Construction versus requests

Alchemy Worker construction resolves capabilities and records infrastructure bindings.
It must not import the application eagerly: the application belongs to the RSC graph, while construction runs in the deployment tool and during isolate initialization.
Use `makeApplicationHttpEffect(() => import("./entry.effront").then(module => module.default))` to defer that import until a request.
The construction Effect captures service references, not ownership of their lifetimes.
The handler merges the live request context over those references and does not restore a construction-time request, runtime context, router or scope.

Application layers are acquired separately for each request.
The native host owns the request scope and retains streaming resources until EOF, failure or cancellation.
Buffered responses can release request services as soon as response construction finishes.
Do not acquire request-scoped connections in the Alchemy Worker construction Effect: Alchemy's isolate scope has no normal teardown hook.

`examples/alchemy/src/entry.workers.ts` demonstrates the full dependency path:

1. Declare `Cloudflare.KV.Namespace("Cache")` as infrastructure.
2. Resolve `Cloudflare.KV.ReadWriteNamespace(Cache)` inside the native Worker's construction Effect.
3. Provide `Cloudflare.KV.ReadWriteNamespaceBinding` explicitly around that construction Effect.
4. Provide the resulting client as the application's `CacheClient` capability to `makeApplicationHttpEffect`.
5. Build `HostLive` inside each live request and perform KV operations there.
6. Render only the resulting application data, never the capability object or host environment.

`CacheClient` stores a reference to the native Alchemy client in Effect Context; it does not serialize values or introduce an RPC boundary.
The current example deliberately types that service using Alchemy's client type, so it is not an Alchemy-independent cache contract.
Applications requiring host independence should define their own capability contract, including errors and runtime requirements.
Alternatively, an application factory can accept the constructed client through a closure; that is a different authoring choice, not a requirement to create another Service.
The factory variant is not implemented or claimed as verified by this example.

The example also calls a React Server Function that reads the request's KV-backed service.
KV is eventually consistent; the fixed greeting demonstrates binding use, not a transactional counter or database abstraction.

## Configuration and Wrangler

Each migrated application has an `alchemy.run.ts`, a native Worker module, and a `vite.config.ts`.
`alchemy.run.ts` defines the stack and providers, the Worker declares infrastructure/runtime requirements, and Vite configures the React compilation graphs.
The adapter uses Alchemy's official `makeWorkerBridge`, rather than passing a Promise-based Fetch function to the Worker.
The native Worker declares `viteEnvironments: { entry: "rsc", children: ["ssr"] }`.
Do not set a competing `vite.main`: the Effront adapter owns the RSC bridge entry.

The migrated applications do not need a hand-maintained `wrangler.toml` or `wrangler.jsonc`.
Their old Wrangler files have been removed.
Vite is still required because it compiles React Server Components, it is not a second infrastructure configuration.
The standalone legacy test fixtures keep their Wrangler configuration because they deliberately test the non-Alchemy adapter.

Alchemy CLI injects the Cloudflare runtime host and the bindings registered during native construction.
Applications do not import the runtime plugin or inspect `ALCHEMY_CLOUDFLARE_VITE_INJECTED`.
The independent browser test owns its local runtime plugin and KV simulator; that setup is not part of the application configuration.
The native bridge uses only Alchemy's injected stack name and stage.
Independent E2E hosts supply these runtime bindings explicitly; applications use `effrontAlchemy()` without duplicate stack configuration.

## Local orchestration

See [Alchemy development commands](../AGENTS.md#development-commands) for package preparation, official CLI orchestration, profile requirements, test-host boundaries, and local ports.
The fixed browser test exercises the committed application without an account, but does not establish CLI planning or cloud deployment behavior by itself.

## Alternative integration

The standard `Website.Vite`/typed-native-env version is preserved on branch `backup/alchemy-website-20260917` at commit `44d234e9`.
This branch instead uses native Worker construction so the application can execute the Alchemy client's Effects directly, without wrapping native Promise APIs.
Both approaches use the official CLI and do not require a manually registered runtime host in application Vite configuration.

## Compatibility

The integration pins Alchemy and its Cloudflare runtime to `2.0.0-beta.77` and the Effect family to `4.0.0-rc.112`.
This Alchemy version uses `Config.string`, which is incompatible with rc.113's renamed API despite its broad declared range.
Keep one coherent Effect version across native bridge, core, platform layers and SQL dependencies.
The local workerd compatibility date is `2026-09-01`, supported by the pinned runtime.

The adapter leaves Alchemy exports and dependency optimization unchanged instead of maintaining a Worker/KV allowlist.
Applications select their capabilities through Alchemy's public APIs, independently of the capabilities demonstrated by the sample.
Shared React/Effect deduplication remains in place.

The pinned beta.77 development host has a known limitation: its automatic dependency optimization can retain Node-only deployment exports from Alchemy's Cloudflare barrels and attempt to run workerd's binary resolver inside a Worker.
Removing the adapter's explicit optimizer configuration does not disable the host's automatic optimization.
A local check with optimization fully disabled also reached the Node-only workerd loader through ordinary module imports and failed.
Both the credential-free Vite development host and the official `vp run dev` command in `examples/alchemy` fail without export projection.
The official CLI completes local planning and starts dependency optimization, but `GET http://127.0.0.1:1337/` returns HTTP 500 with `resolve is not a function` in `workerd/lib/main.js`.
This is a reproduced runtime failure, not an authentication blocker or an untested development path.
The production build/preview browser suite passes and is a separate path.
The adapter deliberately does not reinstate a capability allowlist to hide this host/dependency boundary.

Effect rc.112 transfers streaming scopes before discarding HEAD bodies.
Core normalizes HEAD responses to an empty body while preserving response metadata, preventing a discarded stream from retaining its scope.
The Fetch client has a guarded compatibility accessor for the pinned rc.112 response implementation because that version lacks the newer public final-response URL property.
Both behaviors have maintained regression tests and should be revisited together when upgrading Alchemy/Effect.

## Verification

Use the [package development commands](../AGENTS.md#development-commands) for native helper tests and independent browser acceptance.
The repository checks cover builds, public types, native capability/context propagation, and lifetime regressions.
The native browser suite checks the committed KV example; standalone Fetch/Workers and HMR fixtures remain independent.
Official Alchemy CLI planning and reconciliation require separate verification from the credential-free test host, and neither local check proves cloud deployment or remote permissions.

References: [Alchemy](https://alchemy.run/), [state stores](https://alchemy.run/state-store), [native Worker bridge](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/WorkerBridge.ts), [Vite source integration](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/Sources/Vite.ts), and [KV binding construction](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/KV/NamespaceBinding.ts).
The source links track upstream main; the compatibility findings above were checked against the installed beta.77 package.

## Alternative host

`examples/basic` is a relative symlink to `examples/alchemy`, the default native Alchemy sample.
For Cloudflare Workers without Alchemy, use [`examples/workers`](../../../examples/workers/README.md), which uses a static application import, `createFetchHandler`, and Wrangler bindings.
