`@effront/server` provides native Effect HTTP hosting and static files for Node.js and Bun.
For installation and startup files, see [Node.js / Bun](../platforms/node-bun.md).

## effrontServer {#vite}

`effrontServer(options?: EffrontServerOptions): Plugin` from `@effront/server/vite` connects the native handler to Vite development and preview, and builds a separate production startup entry.
It must follow `effront()`:

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

| Option            | Default                 | Entry contract                                                                              |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `rsc?: string`    | `./src/entry.rsc.ts`    | Named `handler` export containing a native HTTP Effect, such as `toHttpEffect(application)` |
| `server?: string` | `./src/entry.server.ts` | Production startup that launches `serve`                                                    |

Empty entry strings throw `TypeError`.
The RSC entry accepts HMR with `if (import.meta.hot) import.meta.hot.accept();`.

Development and preview use Vite's listener through Node-compatible middleware, not the production startup entry.
`serve` options therefore do not configure Vite's port or hostname.
`@effect/platform-node` is required even when production uses Bun.
Bun-specific runtime behavior requires the built production entry, normally `bun dist/rsc/server.js`, not Vite preview.

## serve {#serve}

`serve(handler, options)` returns a scoped server Layer.
`handler` is an `Effect` yielding `HttpServerResponse`, not a Fetch function.
Launch the Layer with `Layer.launch` and the matching platform Runtime:

| Runtime | `serve` import         | Runtime                                            |
| ------- | ---------------------- | -------------------------------------------------- |
| Node.js | `@effront/server/node` | `NodeRuntime.runMain` from `@effect/platform-node` |
| Bun     | `@effront/server/bun`  | `BunRuntime.runMain` from `@effect/platform-bun`   |

| `ServeOptions` field | Contract                                 |
| -------------------- | ---------------------------------------- |
| `assets`             | Required `AssetOptions`, described below |
| `port`               | Optional number, default `3000`          |
| `hostname`           | Optional string, default `127.0.0.1`     |

Provide remaining application service Layers before launch.
See the [Node.js startup example](../platforms/node-bun.md#node).
The default address accepts local connections only.
An address such as `0.0.0.0` exposes the listener to other machines.
Bun's server also enforces a 10 MiB request-body limit.

## withAssets {#assets}

`withAssets(handler, options)` from `@effront/server/assets` constructs a handler with static-file serving.
`serve` already applies it using its `assets` option.

| `AssetOptions` field  | Contract                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `client.root`         | Required dedicated filesystem directory for browser output                                            |
| `client.prefix`       | Required absolute URL prefix other than `/`, such as `/assets/`                                       |
| `client.cacheControl` | Optional client `Cache-Control` value                                                                 |
| `public.root`         | Required directory when the optional `public` mount is configured, served without an added URL prefix |
| `public.cacheControl` | Optional public `Cache-Control` value                                                                 |

Both cache policies default to `public, max-age=0, must-revalidate`.
Use `public, max-age=31536000, immutable` only for hashed filenames.
With prefix `/assets/`, `/assets/app.js` looks up `app.js` in `client.root`.
Mounts must match the actual output directories and URLs when Vite output or `base` changes.

| Request                                                                   | Result                                       |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| `GET` or `HEAD` inside the client prefix                                  | File response, or 404 for a missing file     |
| `GET` or `HEAD` matching a public file                                    | File response                                |
| Public miss or other method                                               | Application handler                          |
| Flight, Server Function, or `/_effront` request outside the client prefix | Application handler, bypassing public lookup |

There are no directory indexes or SPA fallbacks.
Other filesystem failures remain typed HTTP errors.
Roots are checked at request time, not validated at startup.
Deploy trusted directories and manage their symbolic links.
Effront adds no symlink containment beyond Effect's `HttpStaticServer` path handling.

For an existing Effect HTTP server, obtain the handler with `yield* withAssets(handler, options)` during server construction.
Do not pass the outer construction Effect as the request handler.

| Stage        | Success                | Errors                                         | Required services                              |
| ------------ | ---------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Construction | Request handler Effect | `PlatformError`                                | `FileSystem.FileSystem`, `Path.Path`           |
| Request      | `HttpServerResponse`   | Original handler errors plus `HttpServerError` | Original requirements plus `HttpServerRequest` |

The host owns request scopes and must consume or cancel response bodies.
MIME types, weak ETags, conditionals, and ranges follow Effect `4.0.0-rc.112`:

| Condition                                       | Behavior                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `HEAD` or conditional `304`                     | No file stream acquired                                              |
| Satisfiable single byte range                   | `206`                                                                |
| Multiple, unsupported, or unsafe-integer ranges | Range ignored                                                        |
| Valid but unsatisfiable single range            | `416` with `Content-Range`, without asset cache or validator headers |
| `If-Range`                                      | Ignored                                                              |
| `Range` on `HEAD`                               | Evaluated, possibly `206` or `416`, without a body                   |

Caller-provided `HttpPlatform` or ETag services do not change asset responses.
