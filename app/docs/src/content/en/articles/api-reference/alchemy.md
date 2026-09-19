Use `@effront/alchemy` to connect an Effront application to a native Alchemy Worker and make application services available while requests are handled.
The main entry point is `makeApplicationHttpEffect`: run it during Worker construction, then return the resulting HTTP Effect as `fetch`.
This reference covers that handler, its service requirements, and the Vite plugin options.
For a complete Worker declaration and Stack, follow the [Alchemy setup guide](../platforms/alchemy.md).

## Build a request handler {#http}

**Start with `makeApplicationHttpEffect`**

Import `makeApplicationHttpEffect` from `@effront/alchemy/cloudflare` and call it inside the Effect that constructs your Worker.
The following `construct` is suitable for the third argument to `Cloudflare.Worker` when your application needs no additional construction-time services:

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Effect } from "effect";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect(() =>
    import("./entry.effront").then((module) => module.default),
  );
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

There are two stages here: `yield* makeApplicationHttpEffect(...)` creates a reusable handler during construction, and Alchemy runs that handler for incoming requests.
Only the second stage loads the application and produces a native HTTP response.
The example's `Effect.orDie` is an error-boundary choice, explained below, not a requirement to use that error policy.

**Keep the application import inside its loader**

Both handler APIs accept an `ApplicationLoader<Services, ApplicationError, Requirements>` from `@effront/alchemy/cloudflare`.
Its type is `() => Promise<ApplicationDefinition<Services, ApplicationError, Requirements>>`, so a loader can be written separately as:

```typescript
const load = () => import("./entry.effront").then((module) => module.default);
```

Do not replace this with a static import at the top of the Worker module.
Alchemy evaluates the Worker definition while preparing infrastructure, whereas the application belongs to the request-time RSC graph.
Keeping the dynamic import inside the loader prevents application evaluation during infrastructure construction.

**Choose how to supply application services**

If your application needs a client created during Worker construction, provide that service to `makeApplicationHttpEffect(load)` before running the construction Effect.
For example, `makeApplicationHttpEffect(load).pipe(Effect.provideService(CacheClient, kv))` captures the `kv` reference for the application's `CacheClient` service.
`CacheClient` is defined by the application, and `kv` must already have been obtained from Alchemy.
The [Alchemy example](https://github.com/totto2727-org/effront/tree/main/examples/alchemy) shows the service definition and KV client setup together.

Use `applicationHttpEffect(load, { context? }?)` instead when you want to pass an explicit Effect Context rather than capture the construction Effect's context.
It returns the HTTP handler Effect directly, so there is no outer construction Effect to `yield*`.
For a previously obtained `kv` client:

```typescript
import { applicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Context } from "effect";
import { CacheClient } from "./features/greeting/services";

const fetch = applicationHttpEffect(
  () => import("./entry.effront").then((module) => module.default),
  { context: Context.make(CacheClient, kv) },
);
```

`context` is optional when no captured services are needed.
For either API, the live request's service wins if it has the same key as a captured service.
Construction-time HTTP services, Scope, the Layer memo map, Alchemy `RuntimeContext`, Worker self, generic `Self`, Cloudflare environment, raw Request, Worker environment, and execution context are excluded from capture.
Those host services must come from the live request, not a saved construction context.

**Keep ownership with the service provider**

Neither API acquires the services it captures or extends their lifetimes.
The owner of a captured client must keep it available until every response using it has completed, failed, or been cancelled.
Acquire resources that need request-level cleanup in the application Layer rather than during Worker construction.
That Layer is acquired for each request, and Alchemy retains its request Scope through streaming response completion, failure, or cancellation.

**Handle application failures before returning `fetch`**

Both APIs preserve typed application failures, while Alchemy's native handler accepts a narrower error union.
Handle or map any remaining application errors before returning the handler as `fetch`.
The first example converts them to defects with `Effect.orDie`.
You can instead implement an application-specific error response policy.

## Configure the Worker build {#vite}

Register `effrontAlchemy(options?)` from `@effront/alchemy/cloudflare/vite` after `effront()` so Vite can build the native Worker connection alongside your application:

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

`EffrontAlchemyOptions` contains one option, `worker?: string`.
It selects a module that default-exports the Alchemy Worker, resolves relative to the Vite root, and defaults to `./src/entry.workers.ts`.
An empty string throws `TypeError`.
To move the application entry, use `effront({ application })` instead and update the Worker's dynamic import to match.
The Alchemy plugin does not accept an `application` option or register `effront()` for you.

In the Worker declaration, set `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }`.
Do not also set `vite.main`, because the adapter supplies that entry.

Start the development host with `alchemy dev`, not Vite alone.
Alchemy supplies the Cloudflare runtime plugin and bindings, so do not add a second runtime plugin or Wrangler configuration.
Alchemy `2.0.0-beta.77` requires a configured Cloudflare profile even for local development.
See [local startup](../platforms/alchemy.md#stack) for the corresponding command and authentication setup.
