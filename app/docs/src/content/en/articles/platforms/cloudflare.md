## Connect your application to a Worker {#setup}

Use the dependencies and `src/entry.effront.tsx` application from [Getting started](../guide/getting-started.md).
Add the Workers adapter and Wrangler:

```bash
vp add -D @effront/cloudflare@0.1.4 wrangler
```

Create `src/entry.workers.ts`:

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

## Configure the Worker and build {#vite}

Create `wrangler.jsonc` at the project root:

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

Keep `nodejs_compat` and the `ASSETS` binding.
The build supplies the browser asset directory in the generated Wrangler configuration.

Create `vite.config.ts`:

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

The adapter includes the Cloudflare Vite plugin.
Pass its options directly to `effrontCloudflare({ ...options })`, not inside a `cloudflare` property.
Use the [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/) for additional Worker settings.

## Run and verify your application {#local}

Start development:

```bash
vp dev
```

Open the printed URL and visit a registered route.
The homepage from Getting started should display `Hello, Effront`.

To check the built Worker, stop the development server and run:

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

Use the generated configuration, not the source `wrangler.jsonc`, so Wrangler loads the built Worker and its browser assets.
Keep the complete output, including `dist/rsc/ssr`, when moving the build.
Open Wrangler's URL and check page rendering, styles, and client-side controls.
Neither local workflow deploys the application or requires Cloudflare authentication for this configuration.

## Add application configuration {#context}

To display a configured application name, add `vars` to `wrangler.jsonc`:

```json
{
  "vars": {
    "APP_LABEL": "My Effront App"
  }
}
```

In `src/entry.effront.tsx`, add the accessor import and declaration below, then replace `HomePage`.
Keep the existing `Effect` import, `EFFRONT`, layout, and application export.

```tsx
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

const { getWorkersEnv } = createWorkersContextAccessors<{ APP_LABEL: string }>();

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.gen(function* () {
      const env = yield* getWorkersEnv();
      return <h1>{env.APP_LABEL}</h1>;
    }),
});
```

Restart development after changing Wrangler configuration, then open `/` to see `My Effront App`.
Read environment values inside the request handled by `createFetchHandler`, such as in a Page or request Layer.
The type argument does not validate values at runtime, so validate required values and formats before using them.
For the incoming `request`, `executionContext`, or `waitUntil()`, see the [Workers context accessors](../api-reference/workers.md).

## Keep credentials on the server {#secrets}

Store credentials as Cloudflare secrets, not in `vars`.
Follow [Cloudflare's environment variables documentation](https://developers.cloudflare.com/workers/configuration/environment-variables/) for local secret configuration.
Reading an environment value does not send it to the browser, but rendering it in JSX or passing it as a Client Component prop does.
Return only the values intended for display.

## Use Alchemy instead {#alchemy}

To define the Worker and its resources in code, use the [Alchemy setup](./alchemy.md) instead of this Wrangler setup.
