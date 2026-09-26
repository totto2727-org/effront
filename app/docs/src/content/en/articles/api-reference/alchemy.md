`@effront/alchemy` provides native HTTP handlers and a Vite adapter for hosting Effront applications with Alchemy on Cloudflare Workers.

## HTTP handlers {#http}

| API                                          | Input                                                            | Result                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `applicationHttpEffect(load, { context? }?)` | Deferred application loader and optional captured Effect Context | Native HTTP handler Effect                                                            |
| `makeApplicationHttpEffect(load)`            | Deferred application loader                                      | Construction Effect that captures available external services and returns the handler |

Both accept the exported `ApplicationLoader<Services, ApplicationError, Requirements>` type:

```typescript
import type { ApplicationDefinition } from "@effront/core";

export type ApplicationLoader<Services, ApplicationError, Requirements> = () => Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
>;
```

The loader runs during request handling.
Keep the dynamic import inside it.
A static application import in the Worker module would evaluate the application during infrastructure construction.

This construction Effect is suitable for the third argument of `Cloudflare.Worker` when no additional construction services are needed:

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

The handler succeeds with a native `HttpServerResponse` and retains the [native HTTP](./http.md) error channel.
Alchemy's accepted error union is narrower, so handle or map remaining application failures before returning `fetch`.
`Effect.orDie` is one policy, not a requirement.

**Captured services**

`makeApplicationHttpEffect` captures service references from its construction Context.
`applicationHttpEffect` uses the explicit `context` option, which defaults to an empty Context.
The [Basic example](https://github.com/totto2727-org/effront/tree/main/examples/basic) demonstrates capturing an application service backed by a KV client.

- Live request values override captured services with the same key.
- Capture excludes HTTP services, Scope, Layer memoization state, Alchemy `RuntimeContext`, Worker self, generic `Self`, Cloudflare environment, raw Request, Worker environment, and execution context.
- Capturing a reference does not acquire the service or extend its lifetime. Its owner must retain it through every response that uses it.
- The application Layer is acquired per request. Alchemy retains the request Scope through streaming completion, failure, or cancellation.
- Explicitly required non-host services, including named application capabilities, remain application dependencies after construction-context filtering. Provide them through the application Layer or a captured external Context.

For Worker and Stack declarations, see [Alchemy setup](../platforms/alchemy.md).

## effrontAlchemy {#vite}

`effrontAlchemy(options?: EffrontAlchemyOptions): PluginOption[]` from `@effront/alchemy/cloudflare/vite` must follow `effront()`.
Reversing their plugin order throws `TypeError`. Use this order:

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

| Option   | Type     | Default                  | Contract                                                                                                 |
| -------- | -------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `worker` | `string` | `./src/entry.workers.ts` | Module default-exporting the Alchemy Worker, relative to the Vite root. Empty string throws `TypeError`. |

The adapter has no `application` option and does not register `effront()`.
Application entry changes belong in `effront({ application })` and the Worker's loader import.
The Worker entry must be selected with `effrontAlchemy({ worker })`, not `effront({ rsc })`.
The bridge requires Alchemy-injected `ALCHEMY_STACK_NAME` and `ALCHEMY_STAGE` bindings; missing or empty bindings throw `TypeError` and require startup through `alchemy dev`.
SSR output defaults to a child of the RSC Worker artifact. Explicit output directories are preserved but must be packaged with that artifact.

The Worker declaration requires `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }`.
Do not set `vite.main` or add a second runtime plugin or Wrangler configuration.
Node-only deployment and local-host exports, including infrastructure provider factories, are unavailable to server code during development. Deployment-time exports and production builds are unaffected.
Alchemy supplies the host plugin and bindings through `alchemy dev`, not Vite alone.
Alchemy `2.0.0-beta.79` requires a configured Cloudflare profile even for [local startup](../platforms/alchemy.md#stack).
