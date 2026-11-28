`@effront/alchemy` provides native HTTP handlers and a Vite adapter for hosting Effront applications with Alchemy on Cloudflare Workers.

## HTTP handlers {#http}

Import the explicit-source helpers from `@effront/alchemy/cloudflare`.
Import the configured, no-argument helper from `@effront/alchemy/cloudflare/application`.

| API                                       | Input                                             | Result                                                                                |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `applicationHttpEffect(source)`           | Native application source Effect                  | Native HTTP handler Effect                                                            |
| `makeApplicationHttpEffect(source)`       | Native application source Effect                  | Construction Effect that captures available external services and returns the handler |
| `makeApplicationHttpEffect<Definition>()` | Type of the application configured in `effront()` | The same construction Effect, with a plugin-owned application reference               |

The explicit-source forms accept the exported `ApplicationLoader<Services, ApplicationError, Requirements, SourceError = never, SourceRequirements = never>` type:

```typescript
import type { ApplicationDefinition } from "@effront/core";
import type { Effect } from "effect";

export type ApplicationLoader<
  Services,
  ApplicationError,
  Requirements,
  SourceError = never,
  SourceRequirements = never,
> = Effect.Effect<
  ApplicationDefinition<Services, ApplicationError, Requirements>,
  SourceError,
  SourceRequirements
>;
```

The source Effect runs once per request, not during handler construction.
Its typed failures remain in the handler's error channel, and its service requirements follow the same capture and live-request rules as application requirements.
Use `Effect.succeed(application)` for a static definition.

**Configured application**

With `effront()` and `effrontAlchemy()`, use a type-only application import.
Pass the construction Effect to `Cloudflare.Worker` after providing any required construction services:

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import { Effect } from "effect";
import type application from "./entry.effront";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect<typeof application>();
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

The type import must refer to the application selected by `effront({ application })`, whose default is `./src/entry.effront.tsx`.
TypeScript does not compare the type import with the Vite configuration.
Application modules can evaluate during isolate initialization, so keep their module-level definitions declarative.
Application Layers are acquired per request.
Provide the application's required services when constructing the handler.

For example, the Basic Worker provides its KV client during construction:

```typescript
const construct = Effect.gen(function* () {
  const cache = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
  const fetch = yield* makeApplicationHttpEffect<typeof application>().pipe(
    Effect.provideService(CacheClient, cache),
  );
  return { fetch: fetch.pipe(Effect.orDie) };
}).pipe(Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding));
```

**Explicit source**

In a dedicated RSC entry, pass an application-source Effect:

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Effect } from "effect";
import application from "./entry.effront";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect(Effect.succeed(application));
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

Use the configured helper in a Worker entry shared with infrastructure planning.
Request handling requires the host's RSC integration.
Without it, the adapter fails with a `TypeError` defect.

The handler succeeds with a native `HttpServerResponse` and retains the [native HTTP](./http.md) error channel.
Alchemy's accepted error union is narrower, so handle or map remaining source and application failures before returning `fetch`.
`Effect.orDie` is one policy, not a requirement.

**Captured services**

`makeApplicationHttpEffect` captures service references from its construction Context.
`applicationHttpEffect(source)` composes the source with the native HTTP handler without capturing construction services.
Provide its application and source dependencies through ordinary `Effect.provideService`, `Effect.provideContext`, or `Effect.provide` composition.
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

| Option    | Type     | Default                  | Contract                                                                                                          |
| --------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `worker`  | `string` | `./src/entry.workers.ts` | Module default-exporting the Alchemy Worker, relative to the Vite root. Empty string throws `TypeError`.          |
| `workers` | `string` | None                     | Module with named exports for multiple Alchemy Worker Layers, relative to the Vite root. Use instead of `worker`. |

The adapter has no `application` option and does not register `effront()`.
Application entry changes belong in `effront({ application })` and the Worker's type-only application import, or its explicit source import.
Select the Worker entry with `effrontAlchemy({ worker })`, not `effront({ rsc })`.

The bridge requires Alchemy-injected `ALCHEMY_STACK_NAME` and `ALCHEMY_STAGE` bindings.
Missing or empty bindings throw `TypeError`.
Start the application through `alchemy dev` to supply those bindings.

SSR output defaults to a child of the RSC Worker artifact.
In single-Worker mode, the adapter preserves explicit output directories, but you must package them with that artifact.

The Worker declaration requires `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }`.
Do not set `vite.main` or add a second runtime plugin or Wrangler configuration.
Node-only deployment and local-host exports, including infrastructure provider factories, are unavailable to RSC and SSR server code in both development and production builds.
Deployment-time exports are unaffected.
Alchemy supplies the host plugin and bindings through `alchemy dev`, not Vite alone.
Alchemy `2.0.0-beta.81` requires a configured Cloudflare profile even for [local startup](../platforms/alchemy.md#stack).

### Multiple Workers {#multiple-workers}

Use one Workers module and one Vite configuration for the stack:

```typescript
export default defineConfig({
  plugins: [
    effront({
      application: {
        storefront: "./src/storefront.tsx",
        backoffice: "./src/backoffice.tsx",
      },
    }),
    effrontAlchemy({ workers: "./src/entry.workers.ts" }),
  ],
});
```

Use `effrontWorkerOptions(name)` from `@effront/alchemy/cloudflare` in the props for each `Worker.make` or inline Worker declaration.
It returns the Vite environment selection and a `VITE_EFFRONT_WORKER` binding for Alchemy to forward.
Use the same name for the Worker's exported Layer and its `application` map key.
Names start with a lowercase letter and contain only lowercase letters, digits, and underscores.
Do not use `default`.
If the Worker has other environment bindings, merge them with `effrontWorkerOptions(name).env` instead of replacing it.
Keep application imports type-only when using `makeApplicationHttpEffect<Definition>()`.
Use one application path instead of a map to share an application across all the Workers.

Alchemy starts both Workers when the stack includes both resources.
Each Worker has a separate Vite cache and separate outputs at `dist/<name>/client` and `dist/<name>/rsc`, with SSR under `rsc/ssr`.
Set `build.outDir` to change `dist` for all Workers.
Do not set output directories on the individual environments in this mode.
See the [multi-Worker example](https://github.com/totto2727-org/effront/tree/main/examples/multi-worker) for a complete Workers module and stack.
