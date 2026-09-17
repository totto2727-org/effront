# Alchemy adapter API

The private adapter exposes two explicit subpaths.
Use [the native Worker example](../../../examples/alchemy/src/entry.workers.ts) with its [stack](../../../examples/alchemy/alchemy.run.ts) and [application](../../../examples/alchemy/src/entry.effront.tsx) for complete integration wiring.

## `@effront/alchemy/cloudflare`

### `ApplicationLoader<Services, ApplicationError, Requirements>`

A deferred `() => Promise<ApplicationDefinition<Services, ApplicationError, Requirements>>` loader.
The application belongs to the RSC graph, so defer its import rather than evaluating it during infrastructure construction:

```ts
const load = () => import("./entry.effront").then((module) => module.default);
```

### `makeApplicationHttpEffect(load)`

An Effect evaluated during native Worker construction to capture required application-capability references and return a native HTTP request Effect.
For a KV-backed application, provide the constructed client to the helper:

```ts
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { CacheClient } from "./features/greeting/services";

const Cache = Cloudflare.KV.Namespace("Cache");
const construct = Effect.gen(function* () {
  const kv = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
  const fetch = yield* makeApplicationHttpEffect(() =>
    import("./entry.effront").then((module) => module.default),
  ).pipe(Effect.provideService(CacheClient, kv));
  return { fetch: fetch.pipe(Effect.orDie) };
}).pipe(Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding));
```

Pass `construct` to the native `Cloudflare.Worker` declaration as in the example.
`CacheClient` is an application service holding Alchemy's `ReadWriteNamespaceClient`; the request Layer executes `put` and `get`, then renders only the greeting data.
Provide `ReadWriteNamespaceBinding` explicitly when resolving `ReadWriteNamespace` during construction.
KV is eventually consistent, so this fixed greeting is not a transactional counter.

The helper captures references rather than acquiring their lifetimes.
Do not acquire request-scoped connections during Worker construction, because Alchemy's isolate scope has no normal teardown hook.
The application Layer is acquired in the live request, and Alchemy's official bridge retains the Scope until a streaming response completes, fails, or is cancelled.

Both adapter helpers preserve typed application failures.
Alchemy's native HTTP handler accepts a narrower error union, so handle or map remaining application errors before returning `fetch`.
The example uses `Effect.orDie` at that boundary; an application can choose its own error response policy instead.

### `applicationHttpEffect(load, { context? }?)`

The direct handler API accepts an already constructed Effect Context instead of capturing the current construction context:

```ts
import { applicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Context } from "effect";
import { CacheClient } from "./features/greeting/services";

const fetch = applicationHttpEffect(
  () => import("./entry.effront").then((module) => module.default),
  { context: Context.make(CacheClient, kv) },
);
```

Here `kv` is the client previously obtained from native construction.
Omit `context` when no captured capability is needed.
Live request context overrides captured application capabilities.
Construction-time HTTP services, Scope, Layer memo map, Alchemy `RuntimeContext`, Worker self, generic `Self`, Cloudflare environment, raw Request, Worker environment, and execution context are omitted from capture.
Other explicitly required services remain application dependencies, including named container application capabilities.
This filtering does not remove the application's own capability lifetime obligations.

## `@effront/alchemy/cloudflare/vite`

### `effrontAlchemy(options?)` and `EffrontAlchemyOptions`

Register the native bridge alongside the separate Effront compiler integration:

```ts
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({ plugins: [effront(), effrontAlchemy()] });
```

| Option            | Meaning                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worker?: string` | Native Alchemy Worker module relative to the Vite root, defaulting to `./src/entry.workers.ts`. It must default-export the Worker construct. An empty string throws `TypeError`. |

`worker` is the only Alchemy option.
`effront()` from `@effront/vite` owns the React, RSC, SSR, and browser compilation graphs and the application-entry alias; `effrontAlchemy()` does not register it implicitly.
To select a custom application entry, use `plugins: [effront({ application: "./src/application.tsx" }), effrontAlchemy({ worker: "./src/worker.ts" })]`.
The application entry defaults to `./src/entry.effront.tsx` and resolves relative to the Vite root.

Declare the Worker's Vite environments as `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }`.
The adapter owns the RSC bridge entry, so do not also set `vite.main`.
Register `effront()` before `effrontAlchemy()` so the native bridge is configured before the Cloudflare host captures its Worker entry.
The adapter replaces the portable RSC input and supplies the runtime-phase compilation flag.
Do not use `effront({ rsc })` to select the native Worker module; use `effrontAlchemy({ worker })` instead.
A separate pre-order hook defaults SSR output to a child directory of the RSC Worker artifact; explicit directories are preserved and must still be packaged together by the host.

`effrontAlchemy()` configures compilation, not a running host.
Alchemy CLI injects the Cloudflare host and bindings during official orchestration.
Do not register a second Cloudflare runtime plugin in application Vite configuration or add an `ALCHEMY_CLOUDFLARE_VITE_INJECTED` guard.
The bridge requires Alchemy-injected `ALCHEMY_STACK_NAME` and `ALCHEMY_STAGE`; application options contain no standalone stack identity or stage default.
Missing or empty bindings produce a `TypeError` directing the application to start with `alchemy dev`.

## Alchemy capabilities

Applications choose their Alchemy resources and capabilities through Alchemy's own APIs.
A temporary development compatibility layer subtracts Node-only deployment/local-host exports and provider factories, preserving the other installed Cloudflare exports rather than enumerating allowed capabilities.
It does not configure `optimizeDeps` or impose a version-number gate.
Deployment-time exports and production builds remain intact.
The KV example exercises capability capture and request-local use; it does not define an allowed feature set or establish that every Alchemy capability has been tested.

See [version compatibility](INTEGRATION.md#compatibility) for the pinned development host limitation.
The adapter has no package-root export and is not a promise of registry availability or cloud-deployment verification.
