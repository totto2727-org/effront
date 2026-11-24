# effront migration recipes

For Hono users moving application and UI behavior to effront, not for authors of a replacement renderer.
The source baseline is [effront `3c8c55c8f99242b0c45c5a672fe3ea22f9e26614`](https://github.com/totto2727-org/effront/tree/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614), package family 0.4.2.
Match the installed packages' peer dependencies before using these recipes.
Do not infer host support from a portable Fetch handler alone.

## Contents

- [Application and factory](#application-and-factory)
- [JSX and HTML](#jsx-and-html)
- [Styles](#styles)
- [Static assets](#static-assets)
- [Workers and bindings](#workers-and-bindings)
- [Bun and native listeners](#bun-and-native-listeners)
- [Verification](#verification)
- [Sources](#sources)

## Application and factory

Paths: `hono`, `hono/hono-base`, `hono/factory`.

1. Replace the Hono application or factory with `Application.effront()` from `@effront/core`.
2. Use the returned application's `Page.make`, `Layout.make`, and `Routes.make(...).page(...)` to declare page behavior.
3. Pass the routes to that same application's `make`.
4. Replace Hono `Context` variables with typed Effect services and the application's `Middleware.make` / `withMiddleware` where application middleware is needed.
   Do not mix middleware or page objects created by different `Application.effront()` instances.
5. Export the application definition from the RSC application entry.
   For standalone JSON APIs that do not need this runtime, use `HttpRouter` or `HttpApiBuilder` instead.

`Page`, `Layout`, `Routes`, `Middleware`, and `make` are application-bound properties, not independent named exports from `@effront/core`.
A minimal `src/entry.effront.tsx` is:

```tsx
import { Application } from "@effront/core";
import { Effect } from "effect";

const EFFRONT = Application.effront();

const Layout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>Example</title>
        </head>
        <body>{children}</body>
      </html>,
    ),
});

const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Hello</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: Layout }).page("/", Home),
});
```

Build this entry in effront's RSC graph.
Importing `@effront/core` into an arbitrary default Node graph is not a supported shortcut: its package exports distinguish `react-server` from the unsupported default entry.
Use `@effront/core/http`'s `toHttpEffect(application)` at a native HTTP boundary, or its `makeHttpEffect` when external service references must be captured during construction.
The host owns resource lifetime through response body completion or cancellation.
Do not close a request scope immediately after constructing response headers.

## JSX and HTML

| Hono import                    | Concrete migration                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hono/jsx-renderer`            | Move the document shell to `EFFRONT.Layout.make`, route rendering to `Page.make`, and configure `@effront/vite` instead of installing a Hono renderer middleware.                                                                     |
| `hono/jsx`                     | Rewrite components as React components. Use React hooks and types, mark interactive browser modules with `'use client'`, and keep server Effects in effront render functions.                                                         |
| `hono/jsx/jsx-dev-runtime`     | Remove Hono's `jsxImportSource` and direct runtime imports. Use React's development JSX transform through the effront Vite plugin.                                                                                                    |
| `hono/jsx/jsx-runtime`         | Use React automatic JSX transformation, such as TypeScript `jsx: 'react-jsx'`; let the build emit `react/jsx-runtime` calls. Do not rename imported Hono `jsx` objects at runtime.                                                    |
| `hono/jsx/streaming`           | Replace JSX streaming wrappers with React `Suspense` boundaries and effront's RSC/SSR stream. Preserve loading UI with the application's `Loading` definitions when needed.                                                           |
| `hono/jsx/dom`                 | Move browser state and DOM updates into React Client Components. Keep navigation and hydration under effront's client entry rather than manually rendering a second root over the page.                                               |
| `hono/jsx/dom/jsx-dev-runtime` | Compile browser JSX with the same React development transform. Remove the separate Hono DOM transform configuration.                                                                                                                  |
| `hono/jsx/dom/jsx-runtime`     | Compile Client Components through effront's browser graph with the React automatic runtime. Do not import a Hono DOM node factory.                                                                                                    |
| `hono/jsx/dom/client`          | Remove manual Hono mounting/hydration. Export the application definition in its server entry and let the framework-provided client entry hydrate and handle navigation. Use React DOM directly only for separately owned roots.       |
| `hono/jsx/dom/server`          | Route server rendering through the effront RSC and SSR entries. Do not call React DOM's server API from the browser graph or construct a replacement Flight protocol.                                                                 |
| `hono/html`                    | Use React text and attribute expressions so the renderer escapes data. For a standalone non-UI HTTP endpoint, `HttpServerResponse.html` only marks content type: it does not escape an interpolated string.                           |
| `hono/utils/html`              | Remove escaped-string brands, callback phases, and `raw()` wrappers. Express trusted markup in components, keep untrusted values as React text, and sanitize any deliberately accepted raw HTML before React's raw-HTML escape hatch. |

Do not reproduce Hono hooks by changing only their import paths.
Review event types, React hook rules, component boundaries, and serialization constraints.
Generic SSE and WebSocket data are not RSC or hydration substitutes.
Do not parse effront's HTML/Flight request headers with the generic Accept recipe or override its protocol `Vary` behavior.

## Styles

Paths: `hono/css`, `hono/jsx/dom/css`.

1. Move style rules into stylesheets or React-compatible class composition.
2. For Tailwind, use `effrontTailwind()` from `@effront/tailwind` in the app's Vite plugin list and use the matching installed Tailwind packages.
3. Import the stylesheet through the application's build graph and apply ordinary React `className` values.
4. Replace tagged-template keyframes with stylesheet `@keyframes`; move renderer-side style flushing to the normal build output.

This is a behavior migration, not compatibility for Hono's tagged-template result, generated class names, keyframe objects, or DOM insertion order.
Do not add a second CSS runtime to effect-http.

## Static assets

Path: `hono/serve-static`.
Related utility paths `hono/utils/filepath` and `hono/utils/mime` can use the same static boundary instead of reimplementing file serving.

1. With `@effront/server/node` or `/bun`, pass `assets` to `serve`.
   Configure `client.root` as a trusted deployment directory and `client.prefix` as its dedicated URL namespace.
2. Set an immutable long-lived cache policy only for content-hashed build assets.
   Keep public files revalidated by default.
3. Use the optional `public` root for exact public-file matches.
   Public misses fall through to the app; client-namespace misses are 404.
4. If composing a native handler directly, acquire `withAssets(handler, options)` from `@effront/server/assets` once in the host's filesystem/path service scope, then run its returned request Effect.
5. On Cloudflare, configure the host's assets binding and use the Cloudflare build integration instead of calling native filesystem serving.

`withAssets` already delegates GET/HEAD, MIME, ranges, file ETags, and 304 responses to Effect's static server.
It does not provide directory indexes or a general SPA fallback.
It bypasses public-file interception for effront protocol requests.
Trusted roots remain an operator input; the API does not add extra symlink containment guarantees.
Do not wrap this path in `ResponseCache` or buffer file streams to generate another ETag.

## Workers and bindings

Paths: `hono/cloudflare-workers`, `hono/adapter`.

1. Export the application definition from `src/entry.effront.tsx`.
2. In the Worker entry, import `createFetchHandler` from `@effront/core/workers`, then export `{ fetch: createFetchHandler(application) }`.
3. In `vite.config.ts`, register `effront()` from `@effront/vite` and `effrontCloudflare()` from `@effront/cloudflare`.
   Do not also register React or Vite RSC plugins: effront already owns them.
4. Read bindings in Effects with `createWorkersContextAccessors<Env>()` from `@effront/cloudflare/workers`.
   Its returned `getWorkersEnv()` and `getWorkersRequestContext()` read the current request's host context.
5. Pass application services through the app's Layer boundary rather than capturing bindings in process-global objects or rendering them into Client Components.

The core accessor factory accepts both Env and execution-context type parameters; the Cloudflare factory fixes the execution-context type to its `waitUntil` contract.
Those generic parameters describe types, not runtime validation of bindings.
The public Fetch adapter builds application services per request and retains their scope through streamed-body completion or cancellation.
It is not Hono `env(c)` or runtime auto-detection.
Use `Config` and a caller-owned `Layer` for non-Workers host configuration.

This does not implement Cloudflare Pages `EventContext`, Deno files or upgrades, Lambda/ALB events, Netlify context, Vercel adapters, CloudFront callbacks, or service-worker event registration.
Those distinct paths remain excluded in the map.

## Bun and native listeners

Path: `hono/bun`.
Node hosting is another effront host choice, not an additional Hono public path in this baseline.

1. Convert the application definition to a request Effect with `toHttpEffect` from `@effront/core/http` in the RSC graph.
2. Import `serve` from `@effront/server/bun` and provide the handler and `assets` options.
3. Launch the returned Layer with `Layer.launch` and `BunRuntime.runMain` from `@effect/platform-bun` at the executable entry.
4. For Node, use `@effront/server/node` and `NodeRuntime.runMain` from `@effect/platform-node` instead.
5. Use `effront()` and `effrontServer()` from `@effront/vite` and `@effront/server/vite` for the native Vite integration.

Do not translate Hono's Bun WebSocket callback object into a claimed effront callback API.
Use the actual Effect upgrade/socket path for standalone WebSockets and check host support.
Do not run the native listener entry from inside reusable middleware.

## Verification

Build and run the target application's actual effront Vite graphs and selected host.
Check an HTML request, a navigation/Flight request, browser hydration and an interactive action, unknown routes, and the relevant asset GET/HEAD/range/304 paths.
For Workers, test request binding isolation and confirm secrets are absent from rendered output.
Do not replace these checks with importing the TSX sample in a plain Node process.
The recipes are source-grounded instructions, not a claim that all listed deployments were run for the reader's app.

## Sources

- [Application-bound factory](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/core/src/application/effront.ts), [public exports](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/core/package.json), and [minimal page](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/examples/node/src/entry.effront.tsx).
- [HTTP boundary](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/core/src/http.ts) and [Workers context](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/core/src/workers.ts).
- [Assets](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/server/src/assets.ts), [Node](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/server/src/node.ts), and [Bun](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/server/src/bun.ts).
- [Cloudflare build](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/cloudflare/src/plugin.ts), [binding accessors](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/cloudflare/src/workers.ts), and [Tailwind](https://github.com/totto2727-org/effront/blob/3c8c55c8f99242b0c45c5a672fe3ea22f9e26614/packages/tailwind/src/plugin.ts).
