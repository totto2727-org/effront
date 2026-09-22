# Workers architecture

Workers hosting separates request-scoped application services from three rendering graphs: RSC, SSR, and browser.
The separation keeps host bindings out of the rendering protocol and lets Wrangler attach the server modules required by a built Worker.
The upstream base is `ed886996d1d3780b94166af4f798c53416d547c8`.

## Goal

Run the same Workers-native Fetch application in Cloudflare's Vite development environment and Wrangler's local built-output host.
The original milestone required no container, Bun process, cloud deployment, PR, or npm publishing.
Its storage integrations were deferred.

## Runtime boundaries

```mermaid
flowchart TD
  Host[Workers fetch request / env / executionContext] --> Adapter[@effront/core/workers createFetchHandler]
  Adapter --> Context[Request-scoped Effect context and application Layer]
  Context --> HTTP[Effect HttpEffect.toWebHandler]
  HTTP --> RSC[RSC graph: application and Flight rendering]
  RSC --> SSR[SSR graph: renderHtml]
  RSC --> Flight[Flight Web stream]
  SSR --> HTML[HTML Web stream with embedded Flight]
  HTML --> Browser[Client graph: hydration and navigation]
  Flight --> Browser
```

### Request context and resource lifetime

`createFetchHandler` acquires the application Layer for each request rather than sharing it globally.
Layer acquisition and request handling receive the same Workers context, so services can read the current bindings without sharing request-owned resources.
The response body's EOF, error, or cancellation closes the request scope.

| Reader                                                   | Result                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `getWorkersEnv<Env>()`                                   | The host's environment bindings                                   |
| `getWorkersRequestContext<Env, ExecutionContext>()`      | The original `request`, `env`, and `executionContext` objects     |
| `createWorkersContextAccessors<Env, ExecutionContext>()` | Zero-argument Effect-producing readers with both types bound once |

Both core type parameters default to `unknown`.
The `@effront/cloudflare/workers` factory accepts only `Env` and fixes the execution context to `{ waitUntil(promise: Promise<unknown>): void }`.
Its runtime export is separate from the Cloudflare Vite plugin entry.
Factories create readers of the existing context, not additional services or Layers.
Type parameters assert the host contract rather than validating bindings at runtime.

Bindings are not serialized implicitly.
Applications must still avoid rendering secrets or passing bindings into Client Components.

### Rendering graphs

The RSC graph imports `@vitejs/plugin-rsc/rsc/server` and loads the separate HTML renderer with `import.meta.viteRsc.loadModule("ssr", "index")`.
Only the Flight Web stream and rendering options cross into SSR, not the environment or execution context.
The SSR graph uses the edge-compatible React DOM renderer and the plugin's SSR Flight client.
The browser graph uses the plugin's browser Flight client and hydration entry.

## Host and build ownership

Workers applications register `plugins: [effront(), effrontCloudflare()]`.
`@effront/vite` owns React, Vite RSC, and the React compiler.
`@effront/cloudflare` owns the Cloudflare plugin, Worker/SSR environment wiring, and SSR output layout.
Do not register React or Vite RSC plugins a second time.

| Entry                   | Owner and purpose                                                      |
| ----------------------- | ---------------------------------------------------------------------- |
| `src/entry.workers.ts`  | Application-owned default RSC entry exporting the Workers Fetch object |
| `src/entry.effront.tsx` | Application-owned definition export, kept in the RSC graph             |
| SSR and browser entries | Framework-provided HTML rendering and hydration                        |

The application definition is not the browser hydration entry.
For native Node or Bun hosting, use the separate [`@effront/server` integration](../packages/server/README.md).

The Cloudflare adapter owns `viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }`.
Other options are passed directly to `effrontCloudflare(options)`, not nested under `cloudflare`.
The ordinary configuration uses `effrontCloudflare()` without options.
The adapter forwards those options without disabling state persistence or remote bindings.
It does not set host, port, strict-port mode, project root, or a Wrangler config path.
Vite uses normal configuration discovery from the application directory.

### SSR output and static assets

VitePlus builds the graph-specific outputs.
Wrangler runs the generated `examples/workers/dist/rsc/wrangler.json` using `--local`.
The adapter nests SSR output inside the Worker upload root, by default at `dist/rsc/ssr`, so Wrangler attaches dynamically loaded SSR modules.
A sibling `dist/ssr` can compile successfully but fail at runtime because Wrangler has not attached it to the Worker.

Cloudflare owns static assets.
The example config supplies the assets binding and runtime variables, while the generated Wrangler config supplies the built client asset directory.
The example omits `run_worker_first`, using Cloudflare's default asset-first routing.
Worker-first routing is an application choice when protecting asset requests or overriding a conflicting static URL.
Changing Wrangler runtime variables must not require rebuilding the application.

Packages expose built JavaScript and declarations through explicit exports, which Vite bundles into the application.
The workspace consumer uses the actual `@effront/core`, `@effront/vite`, `@effront/cloudflare`, and `@effront/core/workers` exports.
That consumer alone does not establish unbundled Node compatibility or published-package readiness.

## Tooling

The root `vite.config.ts` owns formatting, lint, and unit-test configuration with VitePlus's default formatting and lint rules.
Ignore patterns exclude dependencies and generated or temporary output.

## Verification contract

- `vp check` checks every retained framework source file, the consumer, and test source.
- `vp test run` checks the retained framework tests, including the public Fetch adapter's request-context and lifecycle behavior.
- `(cd tests/e2e-build && vp run test)` builds its package-local fixture and runs browser acceptance through standalone Wrangler with test runtime bindings.
- `(cd tests/e2e-dev && vp run test)` runs HMR-only acceptance through Vite/workerd with a separate minimal fixture.
- Browser checks cover HTML, Flight, hydrated interaction, navigation, unknown routes, and secret non-disclosure.
- Successful compilation alone does not establish Workers runtime or hydration correctness.

[Historical verification results](WORKERS-VALIDATION.md) map the Workers migration requirements to the checks observed at each milestone.

## Scope

The upstream CLI, Bun server/filesystem hosting, Rspack build machinery, development panel/RPC, Vercel adapter, obsolete examples, and vendored research snapshots were removed.
Git preserves their history.
The original Workers milestone did not deliver Node/Bun adapters or establish their compatibility.
The subsequent `@effront/server` package hosts native Effect HTTP separately and is not validated by the Workers evidence.
D1, KV, R2, authentication integrations, and production deployment were outside that original milestone.

## Official references

- [Effect HttpRouter source](https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/src/unstable/http/HttpRouter.ts)
- [Vite RSC plugin](https://github.com/vitejs/vite-plugin-rsc)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers Fetch handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
- [Wrangler local development](https://developers.cloudflare.com/workers/development-testing/)
- [VitePlus](https://viteplus.dev/)
