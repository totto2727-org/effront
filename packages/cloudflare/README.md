# @effront/cloudflare

Serve Effront applications on Cloudflare Workers and read typed bindings in request Effects.

## Usage

Follow the [Cloudflare Workers guide](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/cloudflare) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/cloudflare)) to create and run a standalone Worker with `effront()` and `effrontCloudflare()`.

## Key features

- Compile an Effront RSC and SSR application for Cloudflare Workers.
- Read typed bindings from the current request without loading the Vite plugin in the Worker.

## Prerequisites

Use the matching Effront core and Vite packages, with a Wrangler configuration and `nodejs_compat`. Publishing requires Cloudflare credentials; local workerd development does not.

## Setup

Follow the [Cloudflare setup](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/cloudflare#setup) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/cloudflare#setup)) for package installation, Worker entry, and Wrangler configuration.

## API

The [Vite API reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/vite#cloudflare) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/vite#cloudflare)) covers plugin options and output paths. The [Workers context reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/workers#cloudflare) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/workers#cloudflare)) covers typed bindings and request accessors.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE). See [third-party notices](THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
