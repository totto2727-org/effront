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

With the Effront and Alchemy Vite plugins, use a type-only application import.
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

The type import must refer to this Worker's entry in `effront({ applications })`, or to `./src/entry.effront.tsx` if `applications` is omitted.
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

`effrontAlchemy(options: EffrontAlchemyOptions): PluginOption[]` from `@effront/alchemy/cloudflare/vite` must follow `effront()`.
Use this order:

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy({ workers: "./src/entry.workers.ts" })],
});
```

> [!WARNING]
> The reverse plugin order throws `TypeError`.

Set `workers` to the path of a module relative to the Vite root. That module exports each Worker by name, even if there is only one.
Spread `effrontWorkerOptions(name)` from `@effront/alchemy/cloudflare` into each Worker declaration. It supplies the `rsc` and `ssr` environment selection and the `VITE_EFFRONT_WORKER` binding that Alchemy forwards to Vite.
The `name` must match the export in the Workers module. Start it with a lowercase letter and use only lowercase letters, digits, and underscores. Do not use `default`.
If the Worker has other environment bindings, merge them with `effrontWorkerOptions(name).env` instead of replacing it.
Configure application entry paths separately with `effront({ applications })`.

The bridge also requires the `ALCHEMY_STACK_NAME` and `ALCHEMY_STAGE` bindings that Alchemy supplies. Missing or empty bindings throw `TypeError`.

Each Worker has its own Vite cache and build outputs: `dist/<name>/client` and `dist/<name>/rsc`, with SSR under `rsc/ssr`.
Set `build.outDir` to change `dist` for all Workers. Do not set output directories on individual environments.
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
      applications: [
        { name: "storefront", entry: "./src/storefront.tsx" },
        { name: "backoffice", entry: "./src/backoffice.tsx" },
      ],
    }),
    effrontAlchemy({ workers: "./src/entry.workers.ts" }),
  ],
});
```

Use each named Worker export as the corresponding `applications` entry's `name`. Each `entry` is an application module path relative to the Vite root.
To use `./src/entry.effront.tsx` for every Worker, omit `applications`.

Alchemy starts both Workers when the stack includes both resources.
See the [multi-Worker example](https://github.com/totto2727-org/effront/tree/main/examples/multi-worker) for a complete Workers module and stack.
