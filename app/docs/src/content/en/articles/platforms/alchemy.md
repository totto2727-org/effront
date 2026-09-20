## Prepare an existing Effront app {#setup}

Alchemy lets you define the Cloudflare Worker that serves your app alongside the resources it uses, such as KV namespaces.
This guide shows how to run an existing Effront application locally with Alchemy and connect the resources it needs.
By the end, you will be able to open a local URL and view a page from your application.

This walkthrough assumes `src/entry.effront.tsx` default-exports your application, including its pages and routes, and the [shared React and Effect dependencies](../api-reference.md#versions) are installed.
Add the adapter and build integration:

```bash
vp add @effront/alchemy@0.1.4 alchemy@2.0.0-beta.77
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc
```

Keep Alchemy and its Cloudflare runtime at `2.0.0-beta.77`, with the Effect packages aligned to `4.0.0-rc.112`.

## Declare the app Alchemy will run {#worker}

First, create `src/entry.workers.ts` to define a Worker whose HTTP handler runs your application.
`makeApplicationHttpEffect` accepts a loader for the application's default export:

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

Keep the dynamic import inside the loader.
Alchemy evaluates the Worker declaration while preparing resources, before it handles requests, so a top-level application import would load the application too early.
The loader defers that work until a request arrives.
The example uses `Effect.orDie` to convert remaining application failures to defects at the Worker's HTTP boundary.
Choose an explicit error response policy there if your application needs one.

Next, create `alchemy.run.ts` at the project root and include the Worker in a Stack.
This gives Alchemy an application to manage and exposes the Worker's URL as a Stack output:

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

This example starts a new application with management state stored locally through `localState()`.

## Start development and open a page {#stack}

Before launching Alchemy, configure Vite to build the application and its Worker together.
Add both plugins to `vite.config.ts`, keeping `effront()` before `effrontAlchemy()`:

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

The CLI needs a configured Cloudflare profile before it can prepare resources, even for local development with `2.0.0-beta.77`.
If your profile is not configured, complete the authentication setup in the [official Alchemy documentation](https://alchemy.run/docs) before continuing.

Add `"dev": "alchemy dev"` to the scripts in `package.json`, then run the script from the project root:

```bash
vp run dev
```

Use this script rather than bare `vp dev`, which does not start the Alchemy host.
Once the Worker is ready, open the local URL printed by the CLI and visit a route defined in `entry.effront.tsx`.
Seeing your page confirms that the Worker, application, and development host are connected.

## Add bindings {#capabilities}

Define the resources your application needs in Alchemy and bind them to the Worker.
Follow the [official Alchemy documentation](https://alchemy.run/docs) for each resource's configuration.

The [Alchemy API reference](../api-reference/alchemy.md) explains how to provide a client obtained from a binding as an Effront service.
The [integration example](https://github.com/totto2727-org/effront/tree/main/examples/alchemy) demonstrates this connection using KV as one example.
