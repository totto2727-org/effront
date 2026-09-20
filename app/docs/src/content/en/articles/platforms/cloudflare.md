Run your Effront application in the Cloudflare Workers runtime while you develop, then check its production build locally before publishing.
The setup below connects an existing application to a Worker and uses Wrangler to configure its assets and environment values.
If you prefer to define infrastructure in code, see the [Alchemy alternative](#alchemy).

## Connect your application to a Worker {#setup}

Start with an application definition in `src/entry.effront.tsx`, as shown in [Getting started](../guide/getting-started.md).
From that application's directory, install the Workers adapter and Wrangler.
The Cloudflare Vite plugin is included with the adapter.

```bash
vp add -D @effront/cloudflare wrangler
```

Your application will use these files:

```text
src/
  entry.workers.ts
  entry.effront.tsx
vite.config.ts
wrangler.jsonc
```

Create `src/entry.workers.ts` with the following Fetch entry.
`createFetchHandler` connects the application definition to the Worker's incoming requests, so you can keep your pages and routes in `entry.effront.tsx`.

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

## Configure the Worker and build {#vite}

Create `wrangler.jsonc` to name the Worker and select the Fetch entry you just added.
Keep `nodejs_compat` enabled for this configuration.
The `assets` setting configures browser asset delivery, and the build will supply the asset directory in the generated Wrangler configuration.

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

Then register the Effront build integration and the Workers adapter in `vite.config.ts`.
This makes the development server run server-side application code in the Workers environment.

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

For a different Wrangler configuration file or other Cloudflare plugin options, pass the options directly to `effrontCloudflare({ ...options })`, not inside a `cloudflare` property.
See the [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/) when adding Worker settings.

## Run and verify your application {#local}

Start the development server from the application directory:

```bash
vp dev
```

Open the URL printed in the terminal.
You should see the page registered in your application definition, ready for you to edit during development.

Once the page works in development, check the built application separately:

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

This runs the built Worker locally without the Vite development server and does not deploy it.
Use the generated `dist/rsc/wrangler.json`, not the source `wrangler.jsonc`: the generated configuration points to the build output and its browser assets.
Keep the generated output together, including the default `dist/rsc/ssr` directory, rather than copying out only the Worker's JavaScript file.

Open Wrangler's local URL and check that your page renders, its styles load, and any client-side controls work.
Both local workflows above can run without Cloudflare authentication for this minimal configuration.

## Add application configuration {#context}

After the application runs, you can make its behavior depend on Worker environment values.
For example, add this `vars` setting to `wrangler.jsonc` to give the application a public display name:

```json
{
  "vars": {
    "APP_LABEL": "My Effront App"
  }
}
```

Use `createWorkersContextAccessors<Env>()` to define typed readers for the values your application expects.
The following Effect combines the configured display name with the current request's path:

```typescript
import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { APP_LABEL: string; SERVER_TOKEN?: string };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();

const requestInfo = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const context = yield* getWorkersRequestContext();
  return { label: env.APP_LABEL, path: new URL(context.request.url).pathname };
});
```

Evaluate `requestInfo` inside a request handled by `createFetchHandler`, such as in a Page or request Layer.
For a request to `/about`, its result contains the configured label and the path `/about`.
The type argument describes the expected values but does not validate them at runtime, so check required values and formats before using them, for example in a request Layer.

`getWorkersEnv()` reads the environment alone.
When you also need the incoming `request` or `executionContext`, use `getWorkersRequestContext()` as above.
The [Workers API reference](../api-reference/workers.md) describes the accessor types and the `executionContext.waitUntil()` contract.

## Keep credentials on the server {#secrets}

A display name is safe to include in `vars` and render on a page, but credentials such as `SERVER_TOKEN` should be configured as Cloudflare secrets.
Follow the [Cloudflare environment variables documentation](https://developers.cloudflare.com/workers/configuration/environment-variables/) for environment variables and local secret configuration.

Reading a secret does not automatically include it in HTML or Flight.
Rendering it in JSX or passing it as a Client Component prop does expose it to the browser.
Keep secrets in server-side code and return only the values intended for display, as the `requestInfo` example does.

## Use Alchemy instead {#alchemy}

If you want to manage Worker infrastructure in code rather than maintaining the Wrangler setup above, use the [Alchemy setup guide](./alchemy.md).
It provides a separate host setup and development workflow for an Effront application.
