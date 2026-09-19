Use `@effront/server` to run an Effront application on Node.js or Bun with its browser assets served alongside it.
This reference explains which entries Vite builds, how to launch the production listener, and how to configure static file lookup.
For installation and a complete working application, start with the [Node.js / Bun guide](../platforms/node-bun.md).

## Vite entries: effrontServer {#vite}

`effrontServer(options?)` from `@effront/server/vite` connects an application's native Effect HTTP handler to Vite and includes a separate production startup module in the build.
Register it after `effront()`:

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

The defaults expect these two entries:

| Option   | Default               | What to put in the entry                                                           |
| -------- | --------------------- | ---------------------------------------------------------------------------------- |
| `rsc`    | `src/entry.rsc.ts`    | A named `handler` export containing an Effect that returns an `HttpServerResponse` |
| `server` | `src/entry.server.ts` | Production startup using `serve`, `Layer.launch`, and the platform Runtime         |

The RSC entry can create `handler` with `toHttpEffect(application)` using your application definition from `src/entry.effront.tsx`.
Include `if (import.meta.hot) import.meta.hot.accept();` in that entry to accept HMR updates.
Set `rsc` or `server` when you use different entry paths.

Development and preview attach the handler to Vite's existing listener through Node-compatible middleware.
They do not execute the production startup entry, so its listener settings do not configure Vite's port or hostname.
The plugin requires `@effect/platform-node` even if you choose Bun for production.
To check Bun-specific behavior, run the built production entry with `bun dist/rsc/server.js` rather than relying on Vite preview.

## Production listener: serve {#serve}

Use `serve(handler, options)` in the production startup entry to serve both the application and its static files.
Choose the import that matches your production runtime:

| Runtime | Import `serve` from    | Run the launched Layer with                        |
| ------- | ---------------------- | -------------------------------------------------- |
| Node.js | `@effront/server/node` | `NodeRuntime.runMain` from `@effect/platform-node` |
| Bun     | `@effront/server/bun`  | `BunRuntime.runMain` from `@effect/platform-bun`   |

`handler` is the native Effect HTTP handler described above, not a Fetch-style function.
`serve` returns a scoped Layer: pass it to `Layer.launch`, then to the chosen Runtime's `runMain`.
Provide any application-specific service Layers that the handler still requires before launching it.
See the [Node.js startup example](../platforms/node-bun.md#node) for the complete composition.

| Option     | Required | Default or purpose                        |
| ---------- | -------- | ----------------------------------------- |
| `assets`   | Yes      | Static file configuration described below |
| `port`     | No       | `3000`                                    |
| `hostname` | No       | `127.0.0.1`                               |

The default listener accepts local connections only.
To expose it outside the local machine, explicitly choose an address such as `hostname: "0.0.0.0"` and check the intended network exposure.

## Static files: withAssets {#assets}

`serve` uses `withAssets` internally, so its `assets` option is where you normally configure file serving.
Pass a required `client` mount for browser build output and, optionally, a `public` mount for files such as `robots.txt`.

| Setting               | Meaning                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `client.root`         | Dedicated filesystem directory containing browser build output             |
| `client.prefix`       | Absolute URL path prefix other than `/`, such as `/assets/`                |
| `client.cacheControl` | Optional `Cache-Control` value for client files                            |
| `public.root`         | Filesystem directory served at matching URL paths, without an added prefix |
| `public.cacheControl` | Optional `Cache-Control` value for public files                            |

For example, with `client.prefix: "/assets/"`, a request for `/assets/app.js` looks up `app.js` in `client.root`.
Match these settings to the actual output directories and URLs whenever you customize Vite's output or `base`.
Both cache settings default to `public, max-age=0, must-revalidate`.
Use an immutable policy such as `public, max-age=31536000, immutable` only for output with hashed filenames.

**Which requests reach the application?**

Static file lookup applies only to `GET` and `HEAD`; other methods reach the application.
Within the client prefix, missing files return 404 instead of falling back to application routes.
Outside that prefix, an exact public file match is served when `public` is configured; otherwise the request reaches the application.
Flight requests, Server Function requests, and `/_effront` or its descendants bypass this public lookup.
Neither mount supplies directory indexes or SPA fallback.
Filesystem failures other than missing files remain typed HTTP errors.

Lookup happens when requests arrive, not during a startup directory check.
Deploy trusted build output and public directories, and manage their contents and symbolic links yourself.
Path decoding, normalization, and traversal handling are delegated to Effect's standard `HttpStaticServer`, rather than custom Effront path validation.

**Using an existing Effect HTTP server**

If you own the HTTP server setup, import `withAssets` from `@effront/server/assets` and call `withAssets(handler, options)` with the same mount configuration.
It returns an Effect that constructs a handler, so obtain the handler with `yield* withAssets(handler, options)` inside your setup Effect before passing it to your server.
Do not pass the construction Effect as if it were the request handler.

Construction requires the caller's `FileSystem` and `Path` services and has `PlatformError` in its error channel.
The constructed handler retains the original handler's service requirements and error type, adding `HttpServerRequest` and `HttpServerError`, respectively.
Your server owns request scopes and must complete or cancel response bodies.
When using `serve`, this integration is already included.

**HTTP response behavior**

MIME types, weak ETags, conditional responses, and byte ranges follow Effect `4.0.0-rc.112`.
Keep these standard behaviors in mind when testing caches or download clients:

| Request or condition                                                       | Result                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `HEAD` or a matching conditional request returning `304`                   | No file stream is acquired                                               |
| Satisfiable single byte range                                              | `206` with the selected range                                            |
| Multiple ranges, unsupported ranges, or ranges outside safe integer bounds | The Range header is ignored                                              |
| Valid but unsatisfiable single range                                       | `416` with `Content-Range`, but without asset cache or validator headers |
| `If-Range`                                                                 | Ignored by this Effect version                                           |
| `Range` on `HEAD`                                                          | Evaluated, potentially returning `206` or `416` without a body           |

Custom caller-provided `HttpPlatform` or ETag services do not change asset responses.
