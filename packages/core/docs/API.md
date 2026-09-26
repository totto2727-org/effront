# Core API and integration entry points

The maintained [English API index](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference) and [Japanese API index](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference) cover the public application and host contracts:

- `@effront/core` application identity and definitions: [Application](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/application) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/application)).
- `Component`, `Page`, `Layout`, `Loading`, and `PageViewTransition`: [Components](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/components) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/components)).
- `Routes` and `Middleware`: [Routing](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/routing) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/routing)).
- `ServerFn`: [Server Functions](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/server-functions) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/server-functions)).
- `@effront/core/http`: [Native HTTP](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/http) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/http)).
- `@effront/core/workers`: [Fetch and request context](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/workers) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/workers)).

For a runnable first page, use [Getting started](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/getting-started) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/guide/getting-started)).

## Integration-only entry points and support

The main `@effront/core` runtime export requires the `react-server` condition in the RSC graph.
SSR and browser code use their separate entry points.
`@effront/core/internal/client-entry` and `@effront/core/internal/ssr-entry` are reserved for matching integration packages, not application authoring.
Alternative bundlers need integration with the Vite RSC runtime protocol used by the current implementation.
See [host support](../../../docs/WORKERS.md) for tested boundaries and [the roadmap](../../../docs/ROADMAP.md) for deferred adapters.
