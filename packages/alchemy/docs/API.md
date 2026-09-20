# Alchemy adapter API

Import HTTP helpers from `@effront/alchemy/cloudflare` and the Vite plugin from `@effront/alchemy/cloudflare/vite`.
There is no package-root export.
For a complete application, use the [native Worker](../../../examples/alchemy/src/entry.workers.ts), [stack](../../../examples/alchemy/alchemy.run.ts), and [application](../../../examples/alchemy/src/entry.effront.tsx) together.

## `@effront/alchemy/cloudflare`

### `ApplicationLoader<Services, ApplicationError, Requirements>`

A deferred `() => Promise<ApplicationDefinition<Services, ApplicationError, Requirements>>` loader.
The application belongs to the RSC graph, so defer its import rather than evaluating it during infrastructure construction:

```ts
const load = () => import("./entry.effront").then((module) => module.default);
```

### `makeApplicationHttpEffect(load)`

Returns a construction Effect that captures application service references and produces a native HTTP request Effect.
For example, this KV-backed Worker provides its client to the application's `CacheClient` service:

```ts
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { CacheClient } from "./features/greeting/services";

const Cache = Cloudflare.KV.Namespace("Cache");
export default class App extends Cloudflare.Worker<App>()(
  "App",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    const kv = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    ).pipe(Effect.provideService(CacheClient, kv));
    return { fetch: fetch.pipe(Effect.orDie) };
  }).pipe(Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding)),
) {}
```

`CacheClient` is defined in the [example's services module](../../../examples/alchemy/src/features/greeting/services.ts).
Its request Layer executes `put` and `get`, then renders only the greeting data.
Provide `ReadWriteNamespaceBinding` explicitly when resolving `ReadWriteNamespace` during construction.
KV is eventually consistent, so this fixed greeting is not a transactional counter.

Capture does not acquire services or extend their lifetimes.
Acquire request-scoped connections in the application Layer, not Worker construction: the isolate scope has no normal teardown hook.
The request Scope remains live until the streaming response completes, fails, or is cancelled.

Both adapter helpers preserve typed application failures.
Alchemy's native HTTP handler accepts a narrower error union, so handle or map remaining application errors before returning `fetch`.
The example uses `Effect.orDie` at that boundary; an application can choose its own error response policy instead.

### `applicationHttpEffect(load, { context? }?)`

Returns a request Effect using an optional supplied Context rather than capturing the current context.
For an application with no external services:

```ts
import { applicationHttpEffect } from "@effront/alchemy/cloudflare";
const fetch = applicationHttpEffect(() =>
  import("./entry.effront").then((module) => module.default),
);
```

To supply constructed services, pass `{ context }` as the second argument, where `context` is an Effect `Context` containing those services.
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
import { defineConfig } from "vite";

export default defineConfig({ plugins: [effront(), effrontAlchemy()] });
```

| Option            | Meaning                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worker?: string` | Native Alchemy Worker module relative to the Vite root, defaulting to `./src/entry.workers.ts`. It must default-export the Worker construct. An empty string throws `TypeError`. |

`worker` is the only Alchemy option.
Register `effront()` separately; `effrontAlchemy()` does not include it.
To select a custom application entry, use `plugins: [effront({ application: "./src/application.tsx" }), effrontAlchemy({ worker: "./src/worker.ts" })]`.
The application entry defaults to `./src/entry.effront.tsx` and resolves relative to the Vite root.

Declare the Worker's Vite environments as `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }`.
The adapter owns the RSC bridge entry, so do not also set `vite.main`.
Register `effront()` before `effrontAlchemy()`; reversed order throws `TypeError`.
Do not use `effront({ rsc })` to select the native Worker module; use `effrontAlchemy({ worker })` instead.
SSR output defaults to a child directory of the RSC Worker artifact; explicit directories are preserved and must still be packaged together by the host.

`effrontAlchemy()` configures compilation, not a running host.
Alchemy CLI injects the Cloudflare host and bindings during official orchestration.
Do not register a second Cloudflare runtime plugin in application Vite configuration.
The bridge requires Alchemy-injected `ALCHEMY_STACK_NAME` and `ALCHEMY_STAGE`; application options contain no standalone stack identity or stage default.
Missing or empty bindings produce a `TypeError` directing the application to start with `alchemy dev`.

## Alchemy capabilities

Applications choose their Alchemy resources and capabilities through Alchemy's own APIs.
Node-only deployment/local-host exports and provider factories are unavailable to server code during development.
This restriction does not affect deployment-time exports or production builds.

See [version compatibility](INTEGRATION.md#compatibility) for the development compiler restrictions and [verification boundaries](INTEGRATION.md#verification) for local-host versus deployment evidence.
