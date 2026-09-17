# Effront Alchemy adapter

This private experimental package composes Effront's Vite graphs for `alchemy@2.0.0-beta.77` Cloudflare Websites.
Its entry point is `@effront/alchemy/cloudflare/vite`.
Infrastructure and application runtime follow Alchemy's [official React Router layout](https://alchemy.run/cloudflare/frontend/react-router/).

## Infrastructure

Keep resource declarations in `alchemy.run.ts`.
The infrastructure module references the runtime by path, without importing the application or React.

```ts
import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export const Website = Cloudflare.Website.Vite("App", {
  main: "./src/entry.workers.ts",
  dev: { port: 1337 },
  compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
  viteEnvironments: { entry: "rsc", children: ["ssr"] },
  env: { Cache: Cloudflare.KV.Namespace("Cache") },
});

export default Stack(
  "example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Website;
    return { url: site.url };
  }),
);
```

## Runtime

The separate `src/entry.workers.ts` statically imports the application through Vite's RSC graph.
It uses the existing host-neutral Fetch boundary rather than introducing an Alchemy runtime wrapper.

```ts
import { createFetchHandler } from "@effront/core/workers";
import application from "./application";

export default { fetch: createFetchHandler(application) };
```

Application layers remain Effect-native and request-scoped, including response streaming completion, errors, and cancellation.
Read typed bindings inside the existing application layer using `getWorkersEnv<InferEnv<typeof Website>>()` from `@effront/core/workers`.
Import `InferEnv` from `alchemy/Cloudflare` and `Website` from the infrastructure file with **type-only imports**, so infrastructure never enters the runtime bundle.
Wrap KV promises with `Effect.tryPromise` at the request's I/O boundary.
No intermediate `CacheClient` service or deferred application loader is required.

### Native binding tradeoff

In beta.77, `Cloudflare.Website.Vite` accepts Worker properties but does not accept a native Worker construction Effect.
This configuration therefore uses Alchemy resource declarations and inferred Worker environment bindings, rather than `yield* Cloudflare.KV.ReadWriteNamespace(Cache)` and its construction-time binding layer.
The application still executes through Effect, but this is not Alchemy's native KV client API.
The former lazy application adapter and optimizer projection have been removed instead of emulating an unsupported native construction boundary.
Effront core's native `toHttpEffect` boundary remains available independently.

## Vite graphs and local development

```ts
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({ plugins: [effrontAlchemy()] });
```

The plugin uses `src/entry.workers.ts` as its runtime entry and `src/entry.client.ts` as its browser application entry.
Override these with `effrontAlchemy({ rsc, application })` when needed.
SSR output defaults to a child directory inside the RSC Worker artifact so workerd can load it.
Explicit output directories are preserved and must still be packaged together by the host.

Run `vp exec alchemy dev --stage local` from the application directory.
Alchemy CLI injects its Cloudflare host plugin, using the declared RSC entry and SSR child environment.
Do not install another host plugin in the application Vite configuration.
The standard beta.77 CLI initializes Cloudflare profile/authentication layers even when using `localState()`.
Local development therefore requires the configured profile, but does not imply authorization for deployment or publication.
The separate local acceptance fixture can inject the official runtime host without changing application configuration.
