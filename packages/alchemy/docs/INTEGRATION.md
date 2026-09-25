# Alchemy-native integration

Alchemy constructs infrastructure capabilities before Effront handles requests.
The adapter connects those two lifetimes without importing the RSC application during construction or serializing host capabilities into rendered output.

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

Native Node/Bun HTTP hosting is provided separately by [`@effront/server`](../../server/README.md), without Alchemy or the Workers Fetch boundary.
The standalone `@effront/cloudflare` adapter uses the Fetch boundary and has independent regression fixtures.

## Construction versus requests

Alchemy Worker construction resolves capabilities and records infrastructure bindings.
It must not import the application eagerly: the application belongs to the RSC graph, while construction runs in the deployment tool and during isolate initialization.
`makeApplicationHttpEffect(() => import("./entry.effront").then(module => module.default))` defers that import until a request.
The construction Effect captures service references, not ownership of their lifetimes.
The handler merges the live request context over those references and does not restore a construction-time request, runtime context, router or scope.

Application layers are acquired separately for each request.
The native host owns the request scope and retains streaming resources until EOF, failure or cancellation.
Buffered responses can release request services as soon as response construction finishes.
Do not acquire request-scoped connections in the Alchemy Worker construction Effect: Alchemy's isolate scope has no normal teardown hook.

`examples/basic/src/entry.workers.ts` demonstrates the full dependency path in the richer Alchemy Basic application. The [minimal Alchemy Cloudflare starter](../../../examples/alchemy-cloudflare/) does not declare KV:

1. Declare `Cloudflare.KV.Namespace("Cache")` as infrastructure.
2. Resolve `Cloudflare.KV.ReadWriteNamespace(Cache)` inside the native Worker's construction Effect.
3. Provide `Cloudflare.KV.ReadWriteNamespaceBinding` explicitly around that construction Effect.
4. Provide the resulting client as the application's `CacheClient` capability to `makeApplicationHttpEffect`.
5. Build `HostLive` inside each live request and perform KV operations there.
6. Render only the resulting application data, never the capability object or host environment.

`CacheClient` stores a reference to the native Alchemy client in Effect Context; it does not serialize values or introduce an RPC boundary.
The service uses Alchemy's client type, so it is not an Alchemy-independent cache contract.
Applications requiring host independence should define their own capability contract, including errors and runtime requirements.

The example also calls a React Server Function that reads the request's KV-backed service.
KV is eventually consistent; the fixed greeting demonstrates binding use, not a transactional counter or database abstraction.

## Configuration and Wrangler

Each Alchemy application has an `alchemy.run.ts`, a native Worker module, and a `vite.config.ts`.
`alchemy.run.ts` defines the stack and providers, the Worker declares infrastructure/runtime requirements, and Vite configures the React compilation graphs.
The [Vite API](API.md#effrontalchemyoptions-and-effrontalchemyoptions) documents plugin registration and entry options.
`effront()` owns the React, RSC, SSR, and browser compilation graphs and the application-entry alias; the Alchemy adapter does not register it implicitly.
The adapter uses Alchemy's official `makeWorkerBridge`, rather than passing a Promise-based Fetch function to the Worker.
Registering `effront()` first lets the adapter replace the portable RSC input before the Cloudflare host captures its Worker entry.
A separate pre-order hook colocates the default SSR output before the portable compiler supplies its generic default, while preserving explicit output directories.
The native Worker declares `viteEnvironments: { entry: "rsc", children: ["ssr"] }`.
Do not set a competing `vite.main`: the Effront adapter owns the RSC bridge entry.

Alchemy supplies the host configuration, so these applications do not maintain a separate Wrangler file.
Vite remains responsible for React compilation, not infrastructure.
Standalone Workers fixtures retain Wrangler configuration to test the non-Alchemy adapter.

Alchemy CLI injects the Cloudflare runtime host and the bindings registered during native construction.
Applications do not import the runtime plugin or inspect `ALCHEMY_CLOUDFLARE_VITE_INJECTED`.
The independent browser test owns its local runtime plugin and KV simulator; that setup is not part of the application configuration.
The native bridge uses only Alchemy's injected stack name and stage.
Independent E2E hosts supply these runtime bindings explicitly; applications compose `effront()` with `effrontAlchemy()` without duplicate stack configuration.

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

Applications select capabilities through Alchemy's public APIs rather than an Effront-defined feature allowlist.
The adapter leaves `optimizeDeps` unchanged and does not reject an Alchemy package based on its version number.
Shared React/Effect deduplication remains in place.

A temporary server-development plugin removes known deployment-only and local-host export modules from Alchemy's Cloudflare entry points.
It reads the installed module exports, subtracts infrastructure-provider factories identified by their actual provider-builder calls, and preserves the remaining exports, including non-KV namespaces, HTTP clients, `BrowserLocal`, and `WorkerConfigProvider`.
The exclusion list is in `src/cloudflare/runtime-projection.ts`; local emulators, artifact builders and stack-state management are not available inside a Worker through these development entry points.
Using a new Alchemy capability does not require adding it to an allowed-export list.

Each requested entry is compiled once into an in-memory virtual runtime module using Vite's build API and Alchemy's purity transform, with Effect and host built-ins shared with the surrounding graph.
This is a development compatibility compilation step, not an `optimizeDeps` setting; the host's own dependency discovery remains unchanged.
Node-side deployment imports, browser modules and production builds are not projected.
Missing actual modules or unsupported module structure still report errors rather than silently inventing exports.
Preserving an API export is not proof of every cloud product's binding or remote behavior.

Removing all compatibility handling caused HTTP 500 in official CLI development because Node-only workerd code was evaluated inside a Worker.
The source TODO calls for removing the temporary filter/compiler when the dependency graph is runtime-safe, with official cold-start development, hydration, Server Functions and HMR as removal checks.

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

`examples/basic` is the default native Alchemy sample.
For Cloudflare Workers without Alchemy, use the [minimal standalone Cloudflare example](../../../examples/cloudflare/), which imports its one-page application into `createFetchHandler` and has a Wrangler configuration without application bindings.
Binding and Server Function behavior is covered by the independent [Workers test fixture](../../../tests/e2e-build/fixture/).
