## Public API map {#exports}

| Import path                        | Main APIs                                                      | Reference                                                                                |
| ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@effront/core`                    | `Application`, `PageViewTransition`                            | [Application](/en/api-reference/application), [components](/en/api-reference/components) |
| `@effront/core/http`               | `toHttpEffect`, `makeHttpEffect`                               | [Native HTTP](./api-reference/http.md)                                                   |
| `@effront/core/workers`            | `createFetchHandler`, `WorkersRequestContext`, context readers | [Fetch and Workers context](/en/api-reference/workers)                                   |
| `@effront/cloudflare/workers`      | `CloudflareExecutionContext`, Cloudflare context readers       | [Fetch and Workers context](/en/api-reference/workers)                                   |
| `@effront/server/node`             | Node.js `serve`                                                | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/server/bun`              | Bun `serve`                                                    | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/server/assets`           | `withAssets`                                                   | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/alchemy/cloudflare`      | `applicationHttpEffect`, `makeApplicationHttpEffect`           | [Alchemy](./api-reference/alchemy.md)                                                    |
| `@effront/vite`                    | `effront`, `EffrontViteOptions`                                | [Vite and Cloudflare plugins](/en/api-reference/vite)                                    |
| `@effront/cloudflare`              | `effrontCloudflare`, `EffrontCloudflareOptions`                | [Vite and Cloudflare plugins](/en/api-reference/vite)                                    |
| `@effront/server/vite`             | `effrontServer`                                                | [Node.js / Bun server](./api-reference/server.md)                                        |
| `@effront/alchemy/cloudflare/vite` | `effrontAlchemy`                                               | [Alchemy](./api-reference/alchemy.md)                                                    |
| `@effront/markdown`                | `createMarkdownCollection`, `parseMarkdown`, `MarkdownError`   | [Markdown](./api-reference/markdown.md)                                                  |
| `@effront/tailwind`                | `effrontTailwind`                                              | [Tailwind](./api-reference/tailwind.md)                                                  |

Runtime imports from `@effront/core` require the `react-server` condition.
Keep them in the application graph configured by `effront()`, not in a host process with `react-server` enabled globally.
For application setup, see [Getting started](/en/guide/getting-started) and [Platforms](/en/platforms).

## Application factory index {#index}

`Application.effront<Services>()` returns these factories and methods.
Related definitions must share one factory instance or a derivative from `withMiddleware`.

| Member                                   | Result                                                                         | Reference                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `Component`, `Page`, `Layout`, `Loading` | Rendered content and route UI definitions                                      | [Components](/en/api-reference/components)         |
| `Routes`, `Middleware`                   | Route groups and scoped request middleware                                     | [Routes and Middleware](/en/api-reference/routing) |
| `ServerFn`                               | Schema-validated Server Functions                                              | [ServerFn](/en/api-reference/server-functions)     |
| `withMiddleware`                         | Derived factories with additional middleware and the same application identity | [Application](/en/api-reference/application)       |
| `make`                                   | An application definition, not a running server                                | [Application](/en/api-reference/application)       |

## Dependency matrix {#versions}

| Package or package family                                           | Version         |
| ------------------------------------------------------------------- | --------------- |
| All Effront packages                                                | `0.1.4`         |
| `react`, `react-dom`                                                | `19.3.0`        |
| `@vitejs/plugin-rsc`                                                | `0.5.35`        |
| `effect`, `@effect/platform-browser`, host-specific Effect packages | `4.0.0-rc.112`  |
| `alchemy`                                                           | `2.0.0-beta.77` |
| `@comark/react`                                                     | `0.6.2`         |

Keep Effront package versions aligned, including optional adapters and integrations.
React and React DOM must match, and `@vitejs/plugin-rsc@0.5.35` includes the matching `19.3.0` RSC transport.
[`ViewTransition`](https://react.dev/reference/react/ViewTransition) and [`addTransitionType`](https://react.dev/reference/react/addTransitionType) are stable React `19.3.0` APIs.
Keep Effect family versions aligned as well.
Vite integrations declare a public Vite peer dependency of `*`.
The setup guides use VitePlus.
