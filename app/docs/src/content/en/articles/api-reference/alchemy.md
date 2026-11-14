`@effront/alchemy` provides native HTTP handlers and a Vite adapter for hosting Effront applications with Alchemy on Cloudflare Workers.

## HTTP handlers {#http}

Import the explicit-loader helpers from `@effront/alchemy/cloudflare`.
Import the configured, no-argument helper from `@effront/alchemy/cloudflare/application`.
The separate entry keeps configured application modules out of hosts that select their own loader.

| API                                          | Input                                                            | Result                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `applicationHttpEffect(load, { context? }?)` | Deferred application loader and optional captured Effect Context | Native HTTP handler Effect                                                            |
| `makeApplicationHttpEffect(load)`            | Deferred application loader                                      | Construction Effect that captures available external services and returns the handler |
| `makeApplicationHttpEffect<Definition>()`    | Type of the application configured in `effront()`                | The same construction Effect, with a plugin-owned application reference               |

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
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import { Effect } from "effect";
import type application from "./entry.effront";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect<typeof application>();
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

The type-only import is erased from the Worker module.
The plugin statically imports the application selected by `effront({ application })`, whose default is `./src/entry.effront.tsx`, only in the RSC graph.
The package's `react-server` entry also statically imports the HTTP renderer; its default deployment entry imports neither runtime module.
Application modules can evaluate during isolate initialization, so keep their module-level definitions declarative.
Application Layers are still acquired per request.
The type import must refer to that same application.
TypeScript does not compare the type import with the Vite configuration.
The application type preserves required capabilities and application failures; it does not provide those capabilities.

For example, the Basic Worker's KV capability remains explicit:

```typescript
const fetch =
  yield *
  makeApplicationHttpEffect<typeof application>().pipe(Effect.provideService(CacheClient, cache));
```

Hosts that own an RSC-only entry can retain the explicit loader API without a dynamic import:

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Effect } from "effect";
import application from "./entry.effront";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect(async () => application);
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

The loader contract remains asynchronous, but it does not require dynamic module loading.
Use the configured helper in a Worker entry shared with infrastructure planning, so application value imports remain confined to the RSC graph.
The configured form throws `TypeError` when a request runs without the RSC integration; deployment construction itself does not load the application.
The configured adapter path uses no dynamic import for its application or renderer, but Vite and the underlying RSC framework can still generate dynamic imports for code splitting.
This API does not derive an application-specific runtime Layer or remove deployment/runtime composition boundaries.

The handler succeeds with a native `HttpServerResponse` and retains the [native HTTP](./http.md) error channel.
Alchemy's accepted error union is narrower, so handle or map remaining application failures before returning `fetch`.
`Effect.orDie` is one policy, not a requirement.

**Captured services**

`makeApplicationHttpEffect` captures service references from its construction Context.
`applicationHttpEffect` captures services only from an explicit `context` option.
Without that option, the handler retains all application service requirements, even if you specify a captured-service type argument.
An options value with an optional `context` property also retains those requirements.
Check that `context` is present and pass it as a required property to remove the captured services from the handler's requirements.
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
