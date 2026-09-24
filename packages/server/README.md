# @effront/server

Serve Effront pages and static assets on Node.js or Bun with native Effect HTTP.

## Usage

Export your application's HTTP handler from `src/entry.rsc.ts`:

```ts
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
```

Start the Node.js server from `src/entry.server.ts`:

```ts
import { NodeRuntime } from "@effect/platform-node";
import { serve } from "@effront/server/node";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc";

serve(handler, {
  port: 3000,
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

With the [Vite plugin](#api) below, this entry is emitted as `dist/rsc/server.js` and serves the application at `http://127.0.0.1:3000`.
The asset paths are relative to that compiled file, not the launch directory.
For Bun, change the imports and launcher in the `src/entry.server.ts` example above, leaving the asset options unchanged:

```ts
// Replace the Node.js imports in src/entry.server.ts with these Bun imports.
import { BunRuntime } from "@effect/platform-bun";
import { serve } from "@effront/server/bun";
import { Layer } from "effect";
```

```ts
// At the end of the existing serve(...) call, replace NodeRuntime.runMain.
}).pipe(Layer.launch, BunRuntime.runMain);
```

The [Node startup](../../examples/node/src/entry.server.ts) and [Bun startup](../../examples/bun/src/entry.server.ts) are complete application examples.

## Key features

- Native `NodeHttpServer` and `BunHttpServer` Layers, owned by standard Effect lifetime management.
- Standard Effect static asset lookup, ETags, HEAD, conditional requests and single byte ranges.
- Vite development and preview integration.

## Prerequisites

- Node.js 22 or later for Vite tooling, and Node.js or Bun 1.4.2 or later for the production server.
- Bun 1.3.13 cannot parse the pinned React SSR output; use the documented newer Bun runtime.
- Matching Effect and platform package versions, currently `4.0.0-rc.116`.
- Effront core and Vite integration with their matching React peers.

## Setup

Install the adapter and Node.js platform dependencies:

```sh
vp add @effront/server@0.1.4 @effect/platform-node@4.0.0-rc.116 effect@4.0.0-rc.116
```

For Bun production, additionally install `@effect/platform-bun@4.0.0-rc.116`.
The `/vite` tooling entry needs `@effect/platform-node` even when the production application uses Bun.
Install the [Vite integration and its peers](../vite/README.md#setup) separately.

## API

### `serve(handler, options)`

Import from `@effront/server/node` or `@effront/server/bun`.
Returns a scoped Layer to launch with `Layer.launch` and the matching platform's `runMain`, as in Usage.
Both subpaths export `ServeOptions`:

| Option     | Default       | Purpose                                                                                 |
| ---------- | ------------- | --------------------------------------------------------------------------------------- |
| `assets`   | Required      | Client and optional public file mounts described below.                                 |
| `port`     | `3000`        | HTTP listener port.                                                                     |
| `hostname` | `"127.0.0.1"` | Listener address. Use `"0.0.0.0"` to accept connections from outside the local machine. |

Application service requirements remain in the returned Layer's type.
The server retains request scopes through streaming completion, failure, or cancellation.

### `effrontServer({ rsc?, server? })`

Import from `@effront/server/vite` and register after `effront()`:

```ts
import { effrontServer } from "@effront/server/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [effront(), effrontServer()] });
```

The exported `EffrontServerOptions` type has two optional paths relative to the Vite root:

- `rsc`: defaults to `src/entry.rsc.ts`, which must export a named `handler` Effect.
- `server`: defaults to `src/entry.server.ts`, the production startup module.

Empty entry paths throw `TypeError`.
Keep the application definition in `src/entry.effront.tsx`, or set its path with `effront({ application })`.
Vite development and preview use Node-compatible middleware, not the Bun production server.
Use the production Bun entry to exercise Bun-only APIs.

### `withAssets(handler, options)`

Import from `@effront/server/assets` when composing your own Effect HTTP host.
It returns a construction Effect requiring `FileSystem` and `Path`, whose result is the request handler.
The `serve` helpers apply it automatically.

The subpath also exports `AssetOptions` and `AssetMount`:

- `client`: a required mount with filesystem `root`, a dedicated non-root absolute URL `prefix`, and optional `cacheControl`.
- `public`: an optional mount with `root` and optional `cacheControl`, served at matching URL paths.
- `cacheControl`: defaults to `"public, max-age=0, must-revalidate"` for either mount. Use immutable caching only for hashed files.

The Usage example assumes `dist/client/assets` at `/assets/`.
Adjust the mounts when changing Vite output directories or base URLs.

> [!WARNING]
> Use trusted deployment/public directories. Their contents and symlinks are your responsibility.

Roots are checked on requests, not at startup.

### Static HTTP behavior

- Only GET and HEAD requests use static assets. Other methods reach the application.
- A missing client asset returns 404. A public-file miss falls through to the application.
- Public mounts serve exact files, without directory indexes or SPA fallback. Flight and Server Function requests bypass them.
- MIME types, weak ETags, conditional requests, path decoding, normalization, and traversal handling follow Effect `4.0.0-rc.116`'s `HttpStaticServer`.
- HEAD and 304 do not open file streams. The host owns stream completion and cancellation. Caller-provided `HttpPlatform` or ETag services do not change asset responses.
- Satisfiable single byte ranges return 206. Unsupported, multipart, and unsafe-integer ranges are ignored.
- An unsatisfiable single range returns 416 with `Content-Range`, but without asset cache or validator headers.
- In this Effect version, `If-Range` is ignored. Range is evaluated for HEAD, which can return 206 or 416 without a body.

## Development

See [development instructions](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
