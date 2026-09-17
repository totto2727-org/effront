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

`examples/workers/src/entry.workers.ts` demonstrates the full dependency path:

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

## Local commands

First run `vp install` and `vp run w:pack` from the repository root.
Then enter `examples/workers`, `examples/markdown`, or `app/docs` and run:

```sh
vp run dev
```

This invokes `alchemy dev`, which plans local resources and injects the Vite host.
Stage selection follows Alchemy defaults: `ALCHEMY_STAGE` when configured, otherwise `dev_${USER}`; the application script does not force a shared stage.
The applications listen on ports 1337, 1338, and 1339 respectively.
Bare `vp dev` invokes Vite directly and bypasses this orchestration.
Local state is generated under ignored `.alchemy/` directories using `localState()`.
Application configuration contains no manual Cloudflare runtime plugin and no Wrangler configuration.

The pinned beta.77 requires a configured Cloudflare profile before planning, even for locally supported Worker and KV resources.
If required, configure it interactively:

```sh
vp exec alchemy profile edit --profile default --add Cloudflare
```

Do not invent credentials or deploy cloud resources to bypass this prerequisite.
The actual CLI was checked with an isolated empty profile and failed with `Provider 'Cloudflare' is not configured in profile 'default'`.
A configured profile permits Alchemy to plan and reconcile locally supported resources without deploying them to the cloud.
Profile configuration is distinct from cloud deployment and does not imply that browser-based login is the only authentication method.

The fixed browser test owns a separate workerd runtime configuration so local acceptance does not require an account.
That test exercises the committed application, but does not establish CLI planning or cloud deployment behavior by itself.

## Alternative integration

The standard `Website.Vite`/typed-native-env version is preserved on branch `backup/alchemy-website-20260917` at commit `44d234e9`.
This branch instead uses native Worker construction so the application can execute the Alchemy client's Effects directly, without wrapping native Promise APIs.
Both approaches use the official CLI and do not require a manually registered runtime host in application Vite configuration.

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
- Official Alchemy CLI planning and reconciliation are verified separately from the credential-free test host; cloud deployment and remote permissions are not inferred from either local check.

References: [Alchemy](https://alchemy.run/), [state stores](https://alchemy.run/state-store), [native Worker bridge](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/WorkerBridge.ts), [Vite source integration](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/Sources/Vite.ts), and [KV binding construction](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/KV/NamespaceBinding.ts).
The source links track upstream main; the compatibility findings above were checked against the installed beta.77 package.
