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
Use `makeApplicationHttpEffect(() => import("./application").then(module => module.default))` to defer that import until a request.
The construction Effect captures service references, not ownership of their lifetimes.
The handler merges the live request context over those references and does not restore a construction-time request, runtime context, router or scope.

Application layers are acquired separately for each request.
The native host owns the request scope and retains streaming resources until EOF, failure or cancellation.
Buffered responses can release request services as soon as response construction finishes.
Do not acquire request-scoped connections in the Alchemy Worker construction Effect: Alchemy's isolate scope has no normal teardown hook.

`examples/workers/src/entry.workers.ts` demonstrates the full dependency path:

1. Declare `Cloudflare.KV.Namespace("Cache")` as infrastructure.
2. Resolve `Cloudflare.KV.ReadWriteNamespace(Cache)` inside the native Worker's construction Effect.
3. Provide `Cloudflare.KV.ReadWriteNamespaceBinding` explicitly around that construction Effect.
4. Provide the resulting client as the application's `CacheClient` capability to `makeApplicationHttpEffect`.
5. Build `HostLive` inside each live request and perform KV operations there.
6. Render only the resulting application data, never the capability object or host environment.

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

For direct local Vite use, each app installs `@alchemy.run/cloudflare-runtime/vite` only when `ALCHEMY_CLOUDFLARE_VITE_INJECTED` is not `"1"`.
Alchemy CLI injects that same runtime plugin itself, so the guard prevents duplicate hosts.
Do not combine this configuration with `@cloudflare/vite-plugin` or `effrontCloudflare()`.
The KV example supplies an explicit local KV simulator for standalone Vite, while Alchemy CLI supplies the binding produced by native construction.
Standalone Vite verifies execution, but does not itself plan or reconcile infrastructure.
The bridge prefers Alchemy's injected stack name and stage over the standalone local fallback.

## Local commands

First run `vp install` and `vp run w:pack` from the repository root.
Then enter `examples/workers`, `examples/markdown`, or `app/docs`:

```sh
vp dev
vp build
vp run local
```

`local` runs `vp preview`, executing the built Worker and nested SSR output in Alchemy's workerd runtime.
It does not run Wrangler or deploy resources.
Local runtime state is generated under ignored `.alchemy/` directories.

`vp run alchemy:dev` invokes the real Alchemy CLI with stage `local`.
In the pinned beta, its Cloudflare provider/RPC bootstrap still requires a configured authentication profile, even for local resources.
This is distinct from direct Vite local execution, which can be checked without cloud credentials.
Do not invent credentials or run a deployment to bypass that prerequisite.
A successful direct Vite test does not establish that authenticated planning, deployment, permissions or remote KV work.

## Compatibility

The integration pins Alchemy and its Cloudflare runtime to `2.0.0-beta.77` and the Effect family to `4.0.0-rc.112`.
This Alchemy version uses `Config.string`, which is incompatible with rc.113's renamed API despite its broad declared range.
Keep one coherent Effect version across native bridge, core, platform layers and SQL dependencies.
The local workerd compatibility date is `2026-09-01`, supported by the pinned runtime.

In beta.77, the public Cloudflare barrels export both runtime APIs and Node-only deployment providers.
Vite dependency optimization otherwise retains the deployment exports and tries to load workerd's Node binary resolver inside workerd itself.
The adapter applies a version-checked, optimizer-only projection of the installed Worker/KV runtime exports and Alchemy's official pure-call plugin.
It forwards to the real installed library modules, without copying Alchemy implementations or changing deployment-time construction imports.
This experimental projection supports the Worker/request services and KV APIs used here, not every Cloudflare product.
Upgrading Alchemy or adding another Cloudflare capability requires reviewing the projection and its tests.
Explicit optimizer entries and shared React/Effect deduplication prevent mixed cold-start module identities.

Effect rc.112 transfers streaming scopes before discarding HEAD bodies.
Core normalizes HEAD responses to an empty body while preserving response metadata, preventing a discarded stream from retaining its scope.
The Fetch client has a guarded compatibility accessor for the pinned rc.112 response implementation because that version lacks the newer public final-response URL property.
Both behaviors have maintained regression tests and should be revisited together when upgrading Alchemy/Effect.

## Verification

- `vp run w:pack`, `vp run check`, and `vp run test` cover builds, public types, native capability/context propagation and lifetime regressions.
- `cd tests/e2e-alchemy && vp run test` builds the committed KV example and checks real native workerd HTML, HEAD, browser hydration, Server Functions and navigation.
- `tests/e2e-build` and `tests/e2e-dev` retain independent standalone Fetch/Workers and HMR coverage.
- Cloud deployment and authenticated Alchemy CLI reconciliation are separate owner-controlled verification steps, not inferred from local checks.

References: [Alchemy](https://alchemy.run/), [state stores](https://alchemy.run/state-store), [native Worker bridge](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/WorkerBridge.ts), [Vite source integration](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/Sources/Vite.ts), and [KV binding construction](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/KV/NamespaceBinding.ts).
The source links track upstream main; the compatibility findings above were checked against the installed beta.77 package.
