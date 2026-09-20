## Install the server integration {#setup}

Use the dependencies and `src/entry.effront.tsx` application from [Getting started](../guide/getting-started.md#application).
For VitePlus tooling, use Node.js 22.18 or newer within 22.x, or Node.js 24.11 or newer.
Keep React and Effect aligned with the [supported package versions](../api-reference.md#versions).

```bash
vp add @effront/server@0.1.4 @effect/platform-node@4.0.0-rc.112
```

Development requires `@effect/platform-node` even if you use [Bun for production](#bun).

## Verify the application in Vite {#entries}

Create `src/entry.rsc.ts` with a named `handler` export and the HMR acceptance statement:

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
if (import.meta.hot) import.meta.hot.accept();
```

Create `vite.config.ts`, registering `effrontServer()` after `effront()`:

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

```bash
vp dev
```

Open the printed URL and check the homepage.
Edit its heading and save to check development updates.
Vite serves the development assets and owns the port, independently of the production settings below.

## Prepare the production asset layout {#assets}

The startup example below uses these default output paths:

| File or directory    | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `dist/rsc/server.js` | Server startup                                        |
| `dist/client/assets` | Generated JavaScript and CSS, served under `/assets/` |
| `dist/client`        | Public files, served by exact file match              |

If you change Vite's output directories or `base`, update the asset roots and client prefix to match.
A missing file under the client prefix returns 404.
Public files have no directory-index or SPA fallback.
Apply `immutable` caching only to generated assets with hashed filenames.

When moving a build, include all output, including SSR modules and browser assets.
Serve only trusted build and public directories, and check symlink targets to avoid exposing unintended files.

## Build and launch a Node.js server {#node}

Create `src/entry.server.ts`:

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

The asset paths are relative to the emitted `dist/rsc/server.js`, not the command's working directory.
If you rename the source entries, set their paths in `effrontServer({ rsc, server })`.

```bash
vp build
node dist/rsc/server.js
```

Open `http://127.0.0.1:3000` and check page rendering, JavaScript and CSS loading, client-side controls, and navigation.
For missing assets, compare the requested URL with the configured prefix and root directory.

The `127.0.0.1` binding accepts local connections only.
Before changing `hostname` to `"0.0.0.0"`, review the intended network exposure.
See [built-application checks](../best-practices/testing.md#production) before release and the [server API reference](../api-reference/server.md) for other options.

## Use Bun for the production server {#bun}

Bun 1.4.2 or later is required.
In `src/entry.server.ts`, keep the handler and asset mounts, then:

1. Replace the `NodeRuntime` import with `import { BunRuntime } from "@effect/platform-bun"`.
2. Import `serve` from `"@effront/server/bun"` instead of `"@effront/server/node"`.
3. End the pipeline with `.pipe(Layer.launch, BunRuntime.runMain)`.

Install the Bun platform package, rebuild, and start the server:

```bash
vp add @effect/platform-bun@4.0.0-rc.112
vp build
bun dist/rsc/server.js
```

Check the same localhost URL using the Bun server.
`vp dev` and `vp preview` use Node-compatible Vite middleware, so test Bun-specific behavior against the built entry running under Bun.
