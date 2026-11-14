`@effront/alchemy` provides native HTTP handlers and a Vite adapter for hosting Effront applications with Alchemy on Cloudflare Workers.

## HTTP handlers {#http}

Import the explicit-loader helper from `@effront/alchemy/cloudflare`.
Import the configured, no-argument helper from `@effront/alchemy/cloudflare/application`.
The separate entry keeps configured application modules out of hosts that select their own loader.

| API                                   | Input                                             | Result                                                                      |
| ------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| `applicationHttpEffect(load)`         | Deferred application loader                       | `HttpApplicationEffect<ApplicationError, Requirements>`                     |
| `applicationHttpEffect<Definition>()` | Type of the application configured in `effront()` | `HttpApplicationEffect` preserving the definition's errors and requirements |

Both forms return the HTTP Effect directly, not a construction Effect.
Neither accepts a `context` option, captures a Context snapshot, nor merges a stored runtime into requests.
Provide application services with native `Effect.provideService` or `Effect.provide` and a Layer.
The native Alchemy bridge owns live host services and the request Scope.
Effront builds application Layers fresh for each request.
Service precedence follows native Effect provision, without a special ambient-request override rule.
A scoped external Layer provided around the handler can finalize after header production, before the streamed body ends.
Put request-owned disposable resources in the application Layer passed to `EFFRONT.make`, not in such an outer Layer.

The explicit form accepts the exported `ApplicationLoader<Services, ApplicationError, Requirements>` type:

```typescript
import type { ApplicationDefinition } from "@effront/core";

export type ApplicationLoader<Services, ApplicationError, Requirements> = () => Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
>;
```

The loader runs during request handling and receives no runtime argument.
With `effront()` and `effrontAlchemy()`, use a type-only application import instead of writing a loader:

```typescript
import { applicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import { Effect } from "effect";
import type application from "./entry.effront";

const construct = Effect.succeed({
  fetch: applicationHttpEffect<typeof application>().pipe(Effect.orDie),
});
```

Worker construction still resolves deployment capabilities when needed.
For example, yield the native KV client, then provide it to the handler without yielding the handler itself:

```typescript
const construct = Effect.gen(function* () {
  const cache = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
  return {
    fetch: applicationHttpEffect<typeof application>().pipe(
      Effect.provideService(CacheClient, cache),
      Effect.orDie,
    ),
  };
});
```

The [Basic example](https://github.com/totto2727-org/effront/tree/main/examples/basic) defines `Cache`, `CacheClient`, and the required native KV binding.
Providing the client does not transfer ownership or extend its lifetime.
Its owner must retain it through every response that uses it.
Alchemy retains the request Scope through streaming completion, failure, or cancellation.

The type-only import is erased from the Worker module.
The plugin statically imports the application selected by `effront({ application })`, whose default is `./src/entry.effront.tsx`, only in the RSC graph.
The package's `react-server` entry also statically imports the HTTP renderer. Its default deployment entry imports neither runtime module.
Application modules can evaluate during isolate initialization, so keep their module-level definitions declarative.
The type import must refer to that same application. TypeScript does not compare it with the Vite configuration.
The application type preserves required capabilities and application failures. It does not provide those capabilities.

Hosts that select their own loader can retain the explicit lazy form for compatibility and graph isolation:

```typescript
import { applicationHttpEffect } from "@effront/alchemy/cloudflare";

const fetch = applicationHttpEffect(() =>
  import("./entry.effront").then((module) => module.default),
);
```

Keep the dynamic import inside the loader.
A static value import in the shared Worker entry would evaluate the RSC application during infrastructure construction.
The configured form throws `TypeError` when a request runs without the RSC integration. Creating the handler does not load the application.
The configured adapter path uses no dynamic import for its application or renderer, but Vite and the underlying RSC framework can still generate dynamic imports for code splitting.
This API does not derive an application-specific runtime Layer or remove deployment/runtime composition boundaries.

The handler succeeds with a native `HttpServerResponse` and retains the [native HTTP](./http.md) error channel.
Alchemy's accepted error union is narrower, so handle or map remaining application failures before returning `fetch`.
`Effect.orDie` is one policy, not a requirement.
For Worker and Stack declarations, refer to [Alchemy setup](../platforms/alchemy.md).

## effrontAlchemy {#vite}

`effrontAlchemy(options?: EffrontAlchemyOptions): PluginOption[]` from `@effront/alchemy/cloudflare/vite` must follow `effront()`:

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
