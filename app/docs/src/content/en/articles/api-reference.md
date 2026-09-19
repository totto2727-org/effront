Find the import path and reference page for the API you are using in the [public API map](#exports).
Page, routing, and server function APIs are members of an application factory rather than separate package imports, so they have their own [factory index](#index).
The [dependency matrix](#versions) records the package versions covered by this reference.
For a complete application setup rather than an API lookup, use [Getting started](/en/guide/getting-started) and the guide for your [platform](/en/platforms).

## Public API map {#exports}

Choose an entry point by the work it performs: defining an application, handling requests, or configuring the build.
The symbols below identify the main APIs at each entry point, while the linked references describe their options, return values, and requirements.

| Import path                        | Main APIs and purpose                                                                                                  | Reference                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@effront/core`                    | `Application` for application definitions and `PageViewTransition` for page transitions                                | [Application](/en/api-reference/application), [components](/en/api-reference/components) |
| `@effront/core/http`               | `toHttpEffect` and `makeHttpEffect` for native Effect HTTP request handling                                            | [Native HTTP](./api-reference/http.md)                                                   |
| `@effront/core/workers`            | `createFetchHandler`, `WorkersRequestContext`, and typed request-context readers for Fetch hosts                       | [Fetch and Workers context](/en/api-reference/workers)                                   |
| `@effront/cloudflare/workers`      | `CloudflareExecutionContext` and typed readers for Cloudflare request context                                          | [Fetch and Workers context](/en/api-reference/workers)                                   |
| `@effront/server/node`             | `serve` for a Node.js HTTP server                                                                                      | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/server/bun`              | `serve` for a Bun HTTP server                                                                                          | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/server/assets`           | `withAssets` for static asset serving                                                                                  | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/alchemy/cloudflare`      | `applicationHttpEffect` and `makeApplicationHttpEffect` for connecting application services to a native Alchemy Worker | [Alchemy](./api-reference/alchemy.md)                                                    |
| `@effront/vite`                    | `effront` and `EffrontViteOptions` for the application's Vite configuration                                            | [Vite and Cloudflare plugins](/en/api-reference/vite)                                    |
| `@effront/cloudflare`              | `effrontCloudflare` and `EffrontCloudflareOptions` for Cloudflare development and builds                               | [Vite and Cloudflare plugins](/en/api-reference/vite)                                    |
| `@effront/server/vite`             | `effrontServer` for Vite development and preview middleware                                                            | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/alchemy/cloudflare/vite` | `effrontAlchemy` for the native Alchemy Worker build integration                                                       | [Alchemy](./api-reference/alchemy.md)                                                    |
| `@effront/markdown`                | `createMarkdownCollection`, `parseMarkdown`, and `MarkdownError` for loading and parsing Markdown                      | [Markdown](./api-reference/markdown.md)                                                  |
| `@effront/tailwind`                | `effrontTailwind` for Tailwind CSS integration                                                                         | [Tailwind](./api-reference/tailwind.md)                                                  |

Runtime imports from `@effront/core` require the `react-server` condition.
Keep application definitions in the RSC entry graph configured by `effront()` rather than enabling that condition for the entire host process.

## Application factory index {#index}

`Application.effront<Services>()` returns the factory used to define an application's UI, routes, middleware, and server functions.
Create it once and share it across those definitions so they belong to the same application identity.
Use the following references for the inputs and results of each factory operation.

| Factory member                           | Use it to                                                                     | Reference                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Component`, `Page`, `Layout`, `Loading` | Define rendered content, page layouts, and loading states                     | [Component, Page, Layout, and Loading](/en/api-reference/components) |
| `Routes`, `Middleware`                   | Map URLs to pages and define middleware behavior and scope                    | [Routes and Middleware](/en/api-reference/routing)                   |
| `ServerFn`                               | Define a server function with Schema-validated input                          | [ServerFn](/en/api-reference/server-functions)                       |
| `withMiddleware`                         | Derive a factory with additional middleware and the same application identity | [Application](/en/api-reference/application)                         |
| `make`                                   | Combine routes and an optional service Layer into an application definition   | [Application](/en/api-reference/application)                         |

Once the definition is ready, connect it through the HTTP or host APIs in the public API map above.
The factory's `make` operation assembles the definition, not a running server.

## Dependency matrix {#versions}

This reference covers Effront `0.1.4` and the dependency versions below.
Keep every Effront package you install on `0.1.4`, including core, vite, cloudflare, server, alchemy, markdown, and tailwind.

| Package or package family                                                                              | Version         |
| ------------------------------------------------------------------------------------------------------ | --------------- |
| Effront packages                                                                                       | `0.1.4`         |
| `react` and `react-dom`                                                                                | `19.3.0`        |
| `@vitejs/plugin-rsc`                                                                                   | `0.5.35`        |
| `effect` and Effect platform packages, including `@effect/platform-browser` and host-specific packages | `4.0.0-rc.112`  |
| `alchemy`                                                                                              | `2.0.0-beta.77` |
| `@comark/react`                                                                                        | `0.6.2`         |

For the base application dependencies, use:

```bash
vp add @effront/core@0.1.4 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0 react-dom@19.3.0
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35
```

React and React DOM must use the same version, and `@vitejs/plugin-rsc@0.5.35` includes the matching `19.3.0` RSC transport.
[`ViewTransition`](https://react.dev/reference/react/ViewTransition) and [`addTransitionType`](https://react.dev/reference/react/addTransitionType) are public APIs in stable React `19.3.0`.
Keep Effect family versions aligned when adding a host's platform packages.
Install host and optional feature dependencies through their respective guides rather than adding every package in the matrix.
Vite integrations declare a public Vite peer dependency of `*`.
The setup guides here use VitePlus.
