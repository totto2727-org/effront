# @effront/core

Build React pages and Server Functions with typed routes and request-local Effect services.

## Usage

Follow [Getting started](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/getting-started) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/guide/getting-started)) to run a page that displays `Hello, world`.
Then use [Pages, layouts, and routes](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/routes) to define your own pages and [Platforms](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms) to choose a host.

## Key features

- Define typed pages, routes, middleware, and Server Functions with request-local Effect services.
- Serve through native Effect HTTP or Web Fetch adapters with React RSC and SSR.

## Prerequisites

- **React and Effect**: use versions matching this package's peer dependencies, including `@effect/platform-browser`.
- **Compilation and host**: use matching `@effront/vite` and a supported [platform](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms).

## Setup

```sh
npm install @effront/core
npm install --save-dev @effront/vite @vitejs/plugin-rsc
```

Install the runtime peers and keep their versions compatible with the installed Effront packages' `peerDependencies`:

```sh
npm install effect @effect/platform-browser react react-dom
```

## API

The [API reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference)) covers application factories, transitions, HTTP handlers, and request context.
See [package integration notes](docs/API.md) for reserved entry points and tested host boundaries.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE), retaining the licensing and history of [effective-rsc](https://effective-rsc.nikhilsnayak.dev/).
See [third-party notices](THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
