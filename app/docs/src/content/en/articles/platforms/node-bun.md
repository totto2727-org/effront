Use `@effront/server` when you want to run an Effront application as a Node.js or Bun HTTP server.
You will first get the application working in Vite, then build a standalone server that serves both pages and their browser assets.
The production example starts on localhost so you can check it before exposing it to other machines.

## Install the server integration {#setup}

Start with the application defined in `src/entry.effront.tsx` in [Getting started](../guide/getting-started.md#application).
For VitePlus tooling, use Node.js 22.18 or newer within the 22.x release line, or Node.js 24.11 or newer.
Align React and Effect with the [supported package versions](../api-reference.md#versions).
Add the server adapter and Vite integration to that application:

```bash
vp add @effront/server@0.1.4 @effect/platform-node@4.0.0-rc.112
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc
```

Both production choices use the same development setup, which requires `@effect/platform-node` even when you will deploy with Bun.
The [Bun startup step](#bun) adds the Bun-specific dependency.

## Verify the application in Vite {#entries}

Create `src/entry.rsc.ts` to expose your application as the named HTTP `handler` that the adapter loads.
Keep the HMR statement so this entry accepts updates during development.

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
if (import.meta.hot) import.meta.hot.accept();
```

Register the server adapter after `effront()` in `vite.config.ts`:

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

You can now start development without creating a production listener.
Do not add `NODE_OPTIONS=--conditions=react-server` to the process environment.
The Vite integration selects the React conditions for each environment.

```bash
vp dev
```

Open the URL printed by Vite, check that the page renders, and edit a page to check that updates appear.
Vite owns the port and serves development assets, so the production port and asset mounts configured below do not affect this step.

## Prepare the production asset layout {#assets}

For pages to load and become interactive, their JavaScript and CSS must be reachable as well as the page responses.
The next example uses the default build layout: the server entry is `dist/rsc/server.js`, browser assets are in `dist/client/assets`, and public files are served from `dist/client`.
Its asset paths are relative to the built server module rather than the directory from which you run the command.

Keep the following settings together when you choose where to put the build:

- `assets.client.root` points to the generated browser assets, and `assets.client.prefix` gives them a dedicated URL namespace such as `/assets/`.
  If a file is missing in that namespace, the server returns 404 instead of trying an application route.
- `assets.public.root` supplies other public files by exact file match.
  It does not look up directory indexes or fall back to an SPA HTML file.
- The example's `immutable` cache setting is for generated assets with hashed filenames.
  Do not apply it to files that change at an unchanged URL.

If you change Vite's output directories or `base`, update these roots and the client prefix to match.
When transferring a build, include the complete output, including SSR modules and browser assets, rather than copying `server.js` alone.
Serve only trusted build output and public files.
Check their contents, including symlink targets, to avoid publishing unintended files.

## Build and launch a Node.js server {#node}

Create `src/entry.server.ts` with the listener and asset mounts below.
It imports the same `handler` used during development and launches the native Node.js server through Effect's runtime.

```typescript
import { NodeRuntime } from "@effect/platform-node";
import { serve } from "@effront/server/node";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc";

serve(handler, {
  port: 3000,
  hostname: "127.0.0.1",
  assets: {
    client: {
      root: fileURLToPath(new URL("../client/assets", import.meta.url)),
      prefix: "/assets/",
      cacheControl: "public, max-age=31536000, immutable",
    },
    public: { root: fileURLToPath(new URL("../client", import.meta.url)) },
  },
}).pipe(Layer.launch, NodeRuntime.runMain);
```

If you use different source entry filenames, set `rsc` and `server` in `effrontServer({ rsc, server })` to their paths.
The defaults are `src/entry.rsc.ts` and `src/entry.server.ts`.
Build the application, then start the emitted server directly:

```bash
vp build
node dist/rsc/server.js
```

Open `http://127.0.0.1:3000` and verify page rendering, client-side interactions, and navigation.
Also check that JavaScript and CSS load successfully.
For missing assets, compare the requested URL with the configured prefix and the files under the corresponding root.

The explicit `127.0.0.1` binding limits access to the local machine.
If the server must accept external connections, review the intended network exposure before changing `hostname` to a value such as `"0.0.0.0"`.
Use the [built-application acceptance checks](../best-practices/testing.md#production) to verify the application before release, and the [serve and withAssets reference](../api-reference/server.md) for additional API details.

## Use Bun for the production server {#bun}

To run the same application on Bun, keep the handler and asset mounts and change the production runtime.
Use Bun 1.4.2 or later because Bun 1.3.13 cannot parse the current React SSR output.

In `src/entry.server.ts`, replace `NodeRuntime` with `BunRuntime` imported from `@effect/platform-bun`, import `serve` from `@effront/server/bun`, and end the pipeline with `Layer.launch, BunRuntime.runMain`.
Then add the Bun platform package and rebuild:

```bash
vp add @effect/platform-bun@4.0.0-rc.112
vp build
bun dist/rsc/server.js
```

Check the application at the same localhost URL, this time using the server started by Bun.
`vp dev` and `vp preview` run through Node-compatible Vite middleware, not the Bun production server.
For any behavior that uses Bun-specific APIs, send requests to the built entry running under `bun dist/rsc/server.js`.
A successful development or preview session does not replace this actual-runtime check.
