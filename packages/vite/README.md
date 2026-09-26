# @effront/vite

Compile Effront pages for server rendering, browser hydration, and client navigation with Vite.

## Usage

Register `effront()` alongside a host adapter. Follow a platform guide for a runnable configuration:

- [Cloudflare Workers](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/cloudflare) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/cloudflare))
- [Node.js](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/node) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/node))
- [Bun](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/bun) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/bun))

## Key features

- Configure browser, RSC, and SSR compilation together with React Compiler.
- Register Effect Schema JIT independently in each execution graph.

## Prerequisites

Use matching `@effront/core` and an explicit RSC/SSR host adapter with a supported Vite development runtime.

## Setup

See the [platform guides](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms)) for matching package dependencies and host setup.

## API

The [Vite API reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/vite) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/vite)) covers plugin registration and application and RSC entry options. For separate execution graphs and native RSC entry alignment, see the package-specific [Schema JIT registration note](docs/SCHEMA-JIT.md).

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
