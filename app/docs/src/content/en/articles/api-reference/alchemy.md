`@effront/alchemy` provides native HTTP handlers and a Vite adapter for hosting Effront applications with Alchemy on Cloudflare Workers.

## HTTP handlers {#http}

| API                                          | Input                                                            | Result                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `applicationHttpEffect(load, { context? }?)` | Deferred application loader and optional captured Effect Context | Native HTTP handler Effect                                                            |
| `makeApplicationHttpEffect(load)`            | Deferred application loader                                      | Construction Effect that captures available external services and returns the handler |
| `makeApplicationHttpEffect<Definition>()`    | Type of the application configured in `effront()`                | The same construction Effect, with a plugin-owned deferred loader                     |

The explicit-loader forms accept the exported `ApplicationLoader<Services, ApplicationError, Requirements>` type:

```typescript
import type { ApplicationDefinition } from "@effront/core";

export type ApplicationLoader<Services, ApplicationError, Requirements> = () => Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
>;
```

The loader runs during request handling.
With `effront()` and `effrontAlchemy()`, use a type-only application import instead of writing a loader:

This construction Effect is suitable for the third argument of `Cloudflare.Worker` when no additional construction services are needed:

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Effect } from "effect";
import type application from "./entry.effront";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect<typeof application>();
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

The type-only import is erased from the Worker module.
The plugin loads the application selected by `effront({ application })`, whose default is `./src/entry.effront.tsx`, only during a live request.
The type import must refer to that same application.
TypeScript does not compare the type import with the Vite configuration.
The application type preserves required capabilities and application failures; it does not provide those capabilities.

For example, the Basic Worker's KV capability remains explicit:

```typescript
const fetch =
  yield *
  makeApplicationHttpEffect<typeof application>().pipe(Effect.provideService(CacheClient, cache));
```

Hosts that select their own loader can retain the explicit form:

```typescript
const fetch =
  yield *
  makeApplicationHttpEffect(() => import("./entry.effront").then((module) => module.default));
```

Keep the dynamic import inside an explicit loader.
A static value import would evaluate the RSC application during infrastructure construction.
The configured form throws `TypeError` when a request runs without the Vite integration; Worker construction itself does not load the application.
This API does not derive an application-specific runtime Layer or remove deployment/runtime composition boundaries.

The handler succeeds with a native `HttpServerResponse` and retains the [native HTTP](./http.md) error channel.
Alchemy's accepted error union is narrower, so handle or map remaining application failures before returning `fetch`.
`Effect.orDie` is one policy, not a requirement.

**Captured services**

`makeApplicationHttpEffect` captures service references from its construction Context.
`applicationHttpEffect` uses the explicit `context` option, which defaults to an empty Context.
The [Basic example](https://github.com/totto2727-org/effront/tree/main/examples/basic) shows an application service backed by a KV client and captured during construction.

- Live request values override captured services with the same key.
- Capture excludes HTTP services, Scope, Layer memoization state, Alchemy `RuntimeContext`, Worker self, generic `Self`, Cloudflare environment, raw Request, Worker environment, and execution context.
- A captured reference does not acquire the service or extend its lifetime. Its owner must retain it through every response that uses it.
- The application Layer is acquired per request. Alchemy retains the request Scope through streaming completion, failure, or cancellation.

For Worker and Stack declarations, refer to [Alchemy setup](../platforms/alchemy.md).

## effrontAlchemy {#vite}

`effrontAlchemy(options?: EffrontAlchemyOptions): PluginOption[]` from `@effront/alchemy/cloudflare/vite` must follow `effront()`.
Use this order:

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

> [!WARNING]
> The reverse plugin order throws `TypeError`.

| Option   | Type     | Default                  | Contract                                                                                                 |
| -------- | -------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `worker` | `string` | `./src/entry.workers.ts` | Module default-exporting the Alchemy Worker, relative to the Vite root. Empty string throws `TypeError`. |

The adapter has no `application` option and does not register `effront()`.
Application entry changes belong in `effront({ application })` and the Worker's type-only application import, or its explicit loader import.
Select the Worker entry with `effrontAlchemy({ worker })`, not `effront({ rsc })`.

The bridge requires Alchemy-injected `ALCHEMY_STACK_NAME` and `ALCHEMY_STAGE` bindings.
Missing or empty bindings throw `TypeError`.
Start the application through `alchemy dev` to supply those bindings.

SSR output defaults to a child of the RSC Worker artifact.
The adapter preserves explicit output directories, but you must package them with that artifact.

The Worker declaration requires `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }`.
Do not set `vite.main` or add a second runtime plugin or Wrangler configuration.
Node-only deployment and local-host exports, including infrastructure provider factories, are unavailable to server code during development. Deployment-time exports and production builds are unaffected.
Alchemy supplies the host plugin and bindings through `alchemy dev`, not Vite alone.
Alchemy `2.0.0-beta.81` requires a configured Cloudflare profile even for [local startup](../platforms/alchemy.md#stack).
