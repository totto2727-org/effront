## Prepare an existing Effront app {#setup}

Use the dependencies and `src/entry.effront.tsx` application from [Getting started](../guide/getting-started.md), then add Alchemy:

```bash
vp add @effront/alchemy@0.1.4 alchemy@2.0.0-beta.77
```

Keep Alchemy and its Cloudflare runtime at `2.0.0-beta.77`, and the [Effect packages](../api-reference.md#versions) at `4.0.0-rc.112`.
The Alchemy CLI requires a configured Cloudflare profile even for local development.
Complete the profile setup in the [Alchemy documentation](https://alchemy.run/docs) before starting the app.

## Declare the app Alchemy will run {#worker}

Create `src/entry.workers.ts`:

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export default Cloudflare.Worker(
  "App",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    );
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);
```

Keep the application import inside the loader so it runs during a request, not while Alchemy prepares resources.
`Effect.orDie` converts unhandled application failures to defects at the Worker's HTTP boundary.
Handle failures before that conversion if you need a specific error response.

Create `alchemy.run.ts` at the project root:

```typescript
import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import Worker from "./src/entry.workers";

export default Stack(
  "my-effront-app",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Worker;
    return { url: site.url };
  }),
);
```

This Stack stores its management state locally and outputs the Worker's URL.

## Start development and open a page {#stack}

Create `vite.config.ts`, with `effront()` before `effrontAlchemy()`:

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

Add `"dev": "alchemy dev"` to `package.json` scripts, then run:

```bash
vp run dev
```

Use this script rather than bare `vp dev`, which does not start the Alchemy host.
Open the local URL printed by the CLI and visit a route in your application.
The homepage from Getting started should display `Hello, Effront`.

## Add bindings {#capabilities}

Define resources with [Alchemy's resource APIs](https://alchemy.run/docs) and bind them to the Worker.
Use the [Alchemy API reference](../api-reference/alchemy.md) to pass a bound client as an application service.
The [integration example](https://github.com/totto2727-org/effront/tree/main/examples/alchemy) uses KV to demonstrate this connection.
