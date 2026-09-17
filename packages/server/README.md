# @effront/server

Native Effect HTTP hosting for Effront applications on Node.js and Bun, with static assets and a separate Vite development integration.

## Usage

Serve a compiled RSC handler and its browser assets on Node.js without a Fetch shim:

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

The server responds with streamed HTML, serves the generated browser modules and styles, and keeps Effect request scopes alive through streaming and client cancellation.
The Bun variant uses `serve` from `@effront/server/bun` and `BunRuntime.runMain` from `@effect/platform-bun`.
The [Node startup](../../examples/node/src/entry.server.ts) and [Bun startup](../../examples/bun/src/entry.server.ts) are complete application examples.

## Key features

- Native `NodeHttpServer` and `BunHttpServer` Layers, owned by standard Effect lifetime management.
- RSC, SSR and browser compilation without process-wide React server conditions.
- Real-path-contained asset lookup, ETags, HEAD, conditional requests and single byte ranges.
- Vite dev and preview middleware without a second listener or Cloudflare dependency.

## Prerequisites

- Node.js 22 or later for Vite tooling, and Node.js or Bun 1.4.2 or later for the production server.
- Bun 1.3.13 cannot parse the pinned React SSR output; use the documented newer Bun runtime.
- Matching Effect and platform package versions, currently `4.0.0-rc.112`.
- Effront core and Vite integration with their matching React peers.

## Setup

This package is introduced by the current change and is not yet available from the registry.
Link an already prepared checkout into a consumer:

```sh
vp link /absolute/path/to/effront/packages/server
vp add @effect/platform-node@4.0.0-rc.112 effect@4.0.0-rc.112
```

For Bun production, additionally install `@effect/platform-bun@4.0.0-rc.112`.
The `/vite` tooling entry needs `@effect/platform-node` even when the production application uses Bun.
Acquire the [portable Vite integration and its peers](../vite/README.md#setup) separately.

## API

- `@effront/server/node` and `/bun`: `serve(handler, options)` returns a scoped Layer. `options.assets` is required, `port` defaults to `3000`, and `hostname` defaults to `127.0.0.1`. Use `0.0.0.0` explicitly when exposing the listener outside the local machine.
- `@effront/server/assets`: `withAssets(handler, options)` constructs a native Effect HTTP handler using the caller's FileSystem, Path, HttpPlatform and ETag services. Configure a dedicated `client` root/prefix and an optional public root. Filesystem roots must exist at startup.
- `@effront/server/vite`: `effrontServer({ rsc?, server? })` is registered after `effront()`. Defaults are `src/entry.rsc.ts` (named `handler` Effect export) and `src/entry.server.ts` (production startup). Keep the application definition in `src/entry.effront.tsx`.

```ts
plugins: [effront(), effrontServer()];
```

Vite development and preview use Node-compatible middleware, not the Bun production server.
Use the production Bun entry to exercise Bun-only APIs.
Default sample paths assume `dist/rsc/server.js`, `dist/client/assets`, and URL prefix `/assets/`; adjust the explicit mounts if you customize Vite output or base URLs.
Public files are exact matches only, without directory indexes or SPA fallback.
Missing files under the client prefix return 404 rather than entering application routes.
HEAD and 304 do not open file streams; unsupported or multiple ranges are ignored, while an unsatisfiable valid single range returns 416.
Serve trusted, immutable deployment directories; pathname containment does not protect against a privileged process replacing files concurrently.

## Development

See [development instructions](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
