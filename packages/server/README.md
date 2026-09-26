# @effront/server

Serve Effront pages and static assets on Node.js or Bun with native Effect HTTP.

## Usage

Follow the [Node.js guide](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/node) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/node)) or [Bun guide](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/bun) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/bun)) to create, build, and run a native HTTP application.

## Key features

- Serve streamed pages and static assets with a request-scoped native Effect HTTP listener.
- Connect Vite development and preview to Node-compatible middleware.

## Prerequisites

Use a supported Node.js development runtime and matching Effect platform packages. The Bun production host requires Bun 1.4.2 or later. See the [runtime requirements](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/server) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/server)).

## Setup

Follow the [Node.js setup](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/node#setup) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/node#setup)) or [Bun setup](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/bun#setup) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/bun#setup)) for host entries, assets, and dependencies.

## API

The [server API reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/server) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/server)) covers `serve`, `effrontServer`, asset mounts, and static HTTP behavior. For RSC entry alignment with Vite's Effect Schema JIT registration, see the [package-specific note](../vite/docs/SCHEMA-JIT.md).

## Development

See [development instructions](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
