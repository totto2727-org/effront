# Effront

Effront is a React meta-framework built on Web standards and Effect, with streamed Server Components, request-scoped services, typed Server Functions, and client navigation on Cloudflare Workers.

## Usage

Choose the package Usage that matches your goal:

- [Core](packages/core/README.md#usage): render an application with typed services, routes, and server-driven interactions.
- [Vite](packages/vite/README.md#usage): connect the application's RSC, SSR, and browser rendering paths.
- [Cloudflare](packages/cloudflare/README.md#usage): serve a Fetch application using Worker bindings without Alchemy.
- [Alchemy](packages/alchemy/README.md#usage): supply native resource capabilities to request rendering and Server Functions.
- [Markdown](packages/markdown/README.md#usage): render a typed content collection with file-relative routes and assets.
- [Tailwind](packages/tailwind/README.md#usage): apply utility styles to initial HTML and hydrated components without a hand-written stylesheet.

The [standalone Workers example](examples/workers/README.md#usage) combines the runtime, tooling, and styling integrations in a small application.

## Key features

- React Server Components and streamed server-rendered HTML with browser hydration.
- Effect service requirements, typed failures, and request-owned resource lifetimes.
- Typed routes, shared layouts, Server Functions, and Page View Transitions.
- Standalone Cloudflare and experimental native Alchemy integrations.
- Optional Markdown rendering and Tailwind styling integrations.

## Prerequisites

- **Host**: Cloudflare Workers or its local workerd runtime with Node compatibility enabled; Node/Bun adapters are not currently supplied.
- **Build integration**: VitePlus with the matching Effront integration and host adapter.
- **Peers**: Effect `4.0.0-rc.112` and React/React DOM `19.3.0-canary-1d34f91d-20260909`; use matching versions across your application.
- **Alchemy**: The experimental adapter is pinned to beta.77; its official CLI requires a configured Cloudflare profile even for local use. Standalone Workers does not require that profile for local development.

## Setup

Effront packages are acquired individually; use the setup instructions for the capabilities you need:

- [Core runtime and required peers](packages/core/README.md#setup).
- [Vite integration](packages/vite/README.md#setup) and [standalone Cloudflare hosting](packages/cloudflare/README.md#setup).
- [Experimental native Alchemy adapter](packages/alchemy/README.md#setup).
- [Markdown content](packages/markdown/README.md#setup) and [Tailwind styling](packages/tailwind/README.md#setup).

## API

- [Core](packages/core/README.md#api): application definitions, components, routes, middleware, Server Functions, and Page View Transitions.
- [Effect HTTP and Fetch](packages/core/README.md#api): native Effect handling and request-context-aware Web Fetch hosting.
- [Vite](packages/vite/README.md#api): RSC, SSR, and browser entry configuration.
- [Cloudflare](packages/cloudflare/README.md#api): standalone Vite hosting and typed Worker context accessors.
- [Alchemy](packages/alchemy/README.md#api): native Worker construction and deferred application loading.
- [Markdown](packages/markdown/README.md#api): collections, parsing, and typed content errors.
- [Tailwind](packages/tailwind/README.md#api): generated or explicit automatically loaded stylesheets.

## Development

See [development instructions](AGENTS.md).

## License

[MIT License](LICENSE), with retained [third-party notices](packages/core/THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
