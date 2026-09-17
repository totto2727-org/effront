# Effront

Effront is a React meta-framework built on Web standards and Effect, with streamed Server Components, request-scoped services, typed Server Functions, and client navigation on Cloudflare Workers, Node.js, and Bun.

Effront is a fork of [effective-rsc](https://github.com/nikhilsnayak/effective-rsc).
Implementation of this fork started from upstream commit [`ed886996d1d3780b94166af4f798c53416d547c8`](https://github.com/nikhilsnayak/effective-rsc/commit/ed886996d1d3780b94166af4f798c53416d547c8).
See [upstream provenance](docs/UPSTREAM.md) for the immutable baseline and subsequent incorporation history.

## Usage

Choose the package Usage that matches your goal:

- [Core](packages/core/README.md#usage): render an application with typed services, routes, and server-driven interactions.
- [Vite](packages/vite/README.md#usage): connect the application's RSC, SSR, and browser rendering paths.
- [Node/Bun server](packages/server/README.md#usage): serve streamed applications and static browser assets through native Effect HTTP.
- [Cloudflare](packages/cloudflare/README.md#usage): serve a Fetch application using Worker bindings without Alchemy.
- [Alchemy](packages/alchemy/README.md#usage): supply native resource capabilities to request rendering and Server Functions.
- [Markdown](packages/markdown/README.md#usage): render a typed content collection with file-relative routes and assets.
- [Tailwind](packages/tailwind/README.md#usage): apply utility styles to initial HTML and hydrated components without a hand-written stylesheet.

The [standalone Workers example](examples/workers/README.md#usage) combines the runtime, tooling, and styling integrations in a small application.

## Key features

- React Server Components and streamed server-rendered HTML with browser hydration.
- Effect service requirements, typed failures, and request-owned resource lifetimes.
- Typed routes, shared layouts, Server Functions, and Page View Transitions.
- Standalone Cloudflare, native Node/Bun, and experimental Alchemy integrations.
- Optional Markdown rendering and Tailwind styling integrations.

## Prerequisites

- **Host**: Cloudflare Workers with Node compatibility, or the [native Node/Bun server](packages/server/README.md#prerequisites).
- **Build integration**: VitePlus with the matching Effront integration and host adapter.
- **Peers**: Effect `4.0.0-rc.112` and React/React DOM `19.3.0-canary-1d34f91d-20260909`; use matching versions across your application.
- **Alchemy**: The experimental adapter is pinned to beta.77; its official CLI requires a configured Cloudflare profile even for local use. Standalone Workers does not require that profile for local development.

## Setup

Effront packages are acquired individually; use the setup instructions for the capabilities you need:

- [Core runtime and required peers](packages/core/README.md#setup).
- [Vite integration](packages/vite/README.md#setup) and [standalone Cloudflare hosting](packages/cloudflare/README.md#setup).
- [Native Node/Bun hosting](packages/server/README.md#setup).
- [Experimental native Alchemy adapter](packages/alchemy/README.md#setup).
- [Markdown content](packages/markdown/README.md#setup) and [Tailwind styling](packages/tailwind/README.md#setup).

## API

- [Core](packages/core/README.md#api): application definitions, components, routes, middleware, Server Functions, and Page View Transitions.
- [Effect HTTP and Fetch](packages/core/README.md#api): native Effect handling and request-context-aware Web Fetch hosting.
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
