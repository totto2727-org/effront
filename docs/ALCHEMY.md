# Alchemy Website integration

This branch is an experimental Alchemy-first configuration of Effront.
`@effront/alchemy` is a private workspace package while the integration is evaluated, not an npm installation promise.
Existing package versions remain unchanged for this experiment; a release requires a separate version and publication decision.

## Boundaries

| Package                            | Responsibility                                                   |
| ---------------------------------- | ---------------------------------------------------------------- |
| `@effront/core`                    | Application definitions, request layers, routing, RSC and SSR    |
| `@effront/core/http`               | Host-neutral native Effect HTTP handlers                         |
| `@effront/core/workers`            | Standard Worker Fetch handler and request-local host context     |
| `@effront/vite`                    | React client/RSC/SSR compilation                                 |
| `@effront/alchemy/cloudflare/vite` | Effront compilation and colocated SSR output for Alchemy Website |

Core imports neither Alchemy nor Cloudflare infrastructure code.
Its native HTTP API remains available for future Effect-native hosts, but the Website integration uses the existing standard Worker Fetch boundary.
The provider-specific integration lives under `packages/alchemy/src/cloudflare/`.
A future AWS integration can add a sibling provider directory and explicit package subpaths without introducing AWS dependencies into core.
The standalone `@effront/cloudflare` adapter remains covered by independent regression fixtures.

## Infrastructure and runtime

The applications follow Alchemy's official React Router frontend integration pattern:

1. `alchemy.run.ts` declares `Cloudflare.Website.Vite`, resources, and typed environment bindings.
2. Vite loads `src/entry.workers.ts`, which statically imports the application and exports the existing `createFetchHandler(application)`.
3. The infrastructure module does not import the application or its Worker runtime entry.
4. Runtime code can import `WebsiteEnv` as a type inferred with `Cloudflare.InferEnv<typeof Website>` without loading the infrastructure module.
5. Application services read the existing request-local Workers context; no boundary-only capability service is required.

This keeps RSC and CSS modules in Vite's compilation graph without a user-authored dynamic import.
The prior lazy application-loader helpers, generated native bridge, runtime-barrel projection, and example `CacheClient` service are no longer needed.

This is deliberately different from native `Cloudflare.Worker` construction with `yield* Cloudflare.KV.ReadWriteNamespace(...)`.
In the pinned beta.77, `Website.Vite` does not accept that construction Effect.
The example instead declares `env: { Cache }` on the Website and performs KV operations through the inferred native binding inside `HostLive`, using `Effect.tryPromise`.
Effect still owns the application's request layers and typed failures, but Alchemy's native KV construction API is not used in this configuration.

Application layers are acquired separately for each request and retained through response body completion, failure, or cancellation by the existing Fetch runtime.
The example also calls a React Server Function that reads the request's KV-backed service.
Only application data is rendered, never the Worker environment or binding object.
KV is eventually consistent; the fixed greeting demonstrates binding use, not a transactional counter.

## Configuration and Wrangler

Each migrated application has an `alchemy.run.ts`, a standard Worker entry, and a `vite.config.ts`.
The Website declares `viteEnvironments: { entry: "rsc", children: ["ssr"] }`.
`effrontAlchemy()` composes Effront's Vite graphs and the nested SSR output layout.
Alchemy CLI injects the Cloudflare runtime host and provisions local bindings.
Do not register a second runtime plugin in the application config.

The migrated applications require no hand-maintained `wrangler.toml` or `wrangler.jsonc`.
Vite is still needed to compile React Server Components, but it does not duplicate infrastructure configuration.
The standalone legacy test fixtures retain Wrangler configuration because they deliberately test the non-Alchemy adapter.
The Alchemy browser test owns an explicit test-only workerd host and KV simulator to keep CI independent of credentials.

## Local commands

First run `vp install` and `vp run w:pack` from the repository root.
Then enter `examples/workers`, `examples/markdown`, or `app/docs` and run:

```sh
vp run dev
```

This invokes `alchemy dev --stage local`, which plans local resources and injects the Vite host.
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
After the owner configured a real profile, the Website configuration created Worker and KV resources marked `(local)` and passed browser acceptance for HTML, HEAD, hydration, KV-backed Server Functions, and navigation.
Profile configuration is distinct from cloud deployment and does not imply that browser-based login is the only authentication method.

The fixed browser test owns a separate workerd runtime configuration so local acceptance does not require an account.
That test exercises the committed application, but does not establish CLI planning or cloud deployment behavior by itself.

## Compatibility

The integration pins Alchemy and its Cloudflare runtime to `2.0.0-beta.77` and the Effect family to `4.0.0-rc.112`.
This Alchemy version uses `Config.string`, which is incompatible with rc.113's renamed API despite its broad declared range.
Keep one coherent Effect version across native bridge, core, platform layers and SQL dependencies.
The local workerd compatibility date is `2026-09-01`, supported by the pinned runtime.

Effect rc.112 transfers streaming scopes before discarding HEAD bodies.
Core normalizes HEAD responses to an empty body while preserving response metadata, preventing a discarded stream from retaining its scope.
The Fetch client has a guarded compatibility accessor for the pinned rc.112 response implementation because that version lacks the newer public final-response URL property.
Both behaviors have maintained regression tests and should be revisited together when upgrading Alchemy/Effect.

## Verification

- `vp run w:pack`, `vp run check`, and `vp run test` cover builds, public types, request context propagation and lifetime regressions.
- `cd tests/e2e-alchemy && vp run test` builds the committed KV example and checks real workerd HTML, HEAD, browser hydration, Server Functions and navigation.
- `tests/e2e-build` and `tests/e2e-dev` retain independent standalone Fetch/Workers and HMR coverage.
- Cloud deployment and remote permissions remain separate owner-controlled verification steps, not inferred from local checks.

References: [official React Router integration](https://alchemy.run/cloudflare/frontend/react-router/), [local development](https://alchemy.run/cloudflare/local-development/), and [native Worker construction](https://alchemy.run/cloudflare/tutorial/part-2/).
The compatibility findings above were checked against the installed beta.77 package.
