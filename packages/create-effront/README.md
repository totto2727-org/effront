# create-effront

Create a minimal Effront React Server Components application for Node.js, Bun, standalone Cloudflare Workers, or Alchemy-managed Cloudflare Workers.

## Usage

Follow [Getting started](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/getting-started) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/guide/getting-started)) to generate a Node.js project. Choose another host in the [platform guides](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms)).

## Prerequisites

Use Node.js 24.11 or later for VitePlus and Bun 1.4.2 or later for a Bun production host. Alchemy local development requires a configured Cloudflare profile.

## Setup

Run `vp create effront -- my-app --platform node` to create an independent project. The [initializer guide](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/getting-started#setup) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/guide/getting-started#setup)) explains installation, other platforms, and safeguards.

## API

Run `vp create effront -- [directory] --platform node|bun|cloudflare|alchemy-cloudflare`. The [initializer instructions](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/getting-started#setup) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/guide/getting-started#setup)) cover interactive prompts, non-interactive arguments, `--help`, and empty-directory safeguards.

## Development

See [Effront development instructions](../../AGENTS.md).

## License

[MIT](LICENSE).
