# @effront/core

Build React pages and Server Functions with typed routes and request-local Effect services.

## Usage

Serve a greeting at `/` by defining a page and its document layout in `src/entry.effront.tsx`:

```tsx
import { Application } from "@effront/core";
import { Effect } from "effect";

const EFFRONT = Application.effront();
const Document = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>Greeting</title>
        </head>
        <body>{children}</body>
      </html>,
    ),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Hello, world!</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: Document }).page("/", Home),
});
```

For a standalone Fetch host, expose the application from `src/entry.workers.ts`:

```ts
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

Register the [Cloudflare integration](../cloudflare/README.md#usage) to serve this Fetch entry.
A request to `/` returns HTML containing `Hello, world!`.
The [standalone Workers example](../../examples/workers/README.md#usage) supplies the complete host configuration.
Native Effect HTTP hosts can instead use [`toHttpEffect` or `makeHttpEffect`](docs/API.md#native-effect-http).

## Key features

- Compose typed Pages, Layouts, Components, Loading fallbacks, Routes, Middleware, and Server Functions from one application identity.
- Acquire Effect application services per request and retain streaming resources through response completion, failure, or cancellation.
- Use React's native Flight and Server Function protocols for SSR, hydration, and navigation.
- Cross-fade routed pages while retaining shared Layout state, with request-local overrides and reduced-motion support.
- Integrate through native Effect HTTP or a Web `Request` to `Response` handler.

## Prerequisites

- **React and Effect**: use versions matching this package's peer dependencies, including the matching `@effect/platform-browser` version.
- **RSC compilation**: use the matching `@effront/vite` integration and its Vite/React Server Components toolchain.
- **Host**: choose [Cloudflare Workers](../cloudflare/README.md), [Node.js or Bun](../server/README.md), or [Alchemy](../alchemy/README.md).

## Setup

```sh
npm install @effront/core@0.1.4
npm install --save-dev @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35
```

For the current compatibility baseline, install matching runtime peers:

```sh
npm install effect@4.0.0-rc.116 @effect/platform-browser@4.0.0-rc.116 react@19.3.0 react-dom@19.3.0
```

## API

See the [core API reference](docs/API.md) for application factories, page transitions, HTTP handlers, request-context readers, and contract types.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE), retaining the licensing and history of [effective-rsc](https://effective-rsc.nikhilsnayak.dev/).
See [third-party notices](THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
