# @effront/core

Effront is a React meta-framework built on Web standards and Effect for rendering streamed pages, sharing request-local services, and calling React Server Functions through a host-neutral HTTP boundary.

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

With the [Cloudflare integration](../cloudflare/README.md#usage), a browser request to `/` receives HTML containing `Hello, world!`, followed by hydration and client navigation support.
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
- **Host**: configure a supported adapter such as [Cloudflare Workers](../cloudflare/README.md); a portable HTTP boundary does not imply that every runtime or bundler is supported.

## Setup

```sh
npm install @effront/core@0.1.4
npm install --save-dev @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35
```

For the current compatibility baseline, install matching runtime peers:

```sh
npm install effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112 react@19.3.0 react-dom@19.3.0
```

## API

The [core API guide](docs/API.md) covers all application factories, page transitions, native HTTP handlers, Fetch handlers, request-context readers, and exported contract types.
Application authoring imports belong to the RSC graph; `internal/*` entry points are reserved for matching build integrations.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE), retaining the licensing and history of [effective-rsc](https://effective-rsc.nikhilsnayak.dev/).
See [third-party notices](THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
