# Effront

Effront renders React applications on Cloudflare Workers, Node.js, and Bun, with streamed Server Components, request-scoped Effect services, typed Server Functions, and client navigation.

Effront is a fork of [effective-rsc](https://github.com/nikhilsnayak/effective-rsc).
Implementation of this fork started from upstream commit [`ed886996d1d3780b94166af4f798c53416d547c8`](https://github.com/nikhilsnayak/effective-rsc/commit/ed886996d1d3780b94166af4f798c53416d547c8).
See [upstream provenance](docs/UPSTREAM.md) for the immutable baseline and subsequent incorporation history.

## Quick start

Create a one-page Node.js application, install its dependencies, and start the development server:

```sh
vp create effront -- my-app --platform node
cd my-app
vp install
vp dev
```

For other configurations, see [Platforms](app/docs/src/content/en/articles/platforms.md).

## Usage

| To…                                                              | Use…                                               |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| Render routes with typed services and server-driven interactions | [Core](packages/core/README.md#usage)              |
| Build the application's server and browser entries               | [Vite](packages/vite/README.md#usage)              |
| Serve streamed pages and static assets on Node.js or Bun         | [Node/Bun server](packages/server/README.md#usage) |
| Serve a Fetch application with Worker bindings, without Alchemy  | [Cloudflare](packages/cloudflare/README.md#usage)  |
| Use Alchemy resource capabilities in pages and Server Functions  | [Alchemy](packages/alchemy/README.md#usage)        |
| Render Markdown with file-relative links and images              | [Markdown](packages/markdown/README.md#usage)      |
| Apply utility styles to server-rendered and hydrated components  | [Tailwind](packages/tailwind/README.md#usage)      |

## Key features

- React Server Components and streamed server-rendered HTML with browser hydration.
- Effect service requirements, typed failures, and request-owned resource lifetimes.
- Typed routes, shared layouts, Server Functions, and Page View Transitions.
- Standalone Cloudflare, native Node/Bun, and Alchemy integrations.
- Optional Markdown rendering and Tailwind styling integrations.

## Prerequisites

- **Host**: Cloudflare Workers with Node compatibility, or the [native Node/Bun server](packages/server/README.md#prerequisites).
- **Build integration**: VitePlus with the matching Effront integration and host adapter.
- **Peers**: Effect `4.0.0-rc.116` and React/React DOM `19.3.0`; use matching versions across your application.
- **Alchemy**: The adapter is pinned to beta.79; its official CLI requires a configured Cloudflare profile even for local use. Standalone Workers does not require that profile for local development.

## Setup

Install the packages for your application through their consumer setup instructions:

- [Core runtime and required peers](packages/core/README.md#setup).
- [Vite integration](packages/vite/README.md#setup) and [standalone Cloudflare hosting](packages/cloudflare/README.md#setup).
- [Native Node/Bun hosting](packages/server/README.md#setup).
- [Native Alchemy adapter](packages/alchemy/README.md#setup).
- [Markdown content](packages/markdown/README.md#setup) and [Tailwind styling](packages/tailwind/README.md#setup).

## API

- [Core](packages/core/README.md#api): application definitions, components, routes, middleware, Server Functions, Page View Transitions, and Effect HTTP/Fetch handlers.
- [Vite](packages/vite/README.md#api): RSC, SSR, and browser entry configuration.
- [Node/Bun server](packages/server/README.md#api): scoped native listeners, static assets, and Vite development hosting.
- [Cloudflare](packages/cloudflare/README.md#api): standalone Vite hosting and typed Worker context accessors.
- [Alchemy](packages/alchemy/README.md#api): native Worker construction and deferred application loading.
- [Markdown](packages/markdown/README.md#api): collections, parsing, and typed content errors.
- [Tailwind](packages/tailwind/README.md#api): generated or explicit automatically loaded stylesheets.

## Development

See [development instructions](AGENTS.md).

## License

[MIT License](LICENSE), with retained [third-party notices](packages/core/THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
