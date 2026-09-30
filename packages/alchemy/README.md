# @effront/alchemy

Serve Effront pages and Server Functions on Alchemy Cloudflare Workers with request-local Effect services.

## Usage

Use the [Alchemy Cloudflare guide](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/alchemy) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/alchemy)) to create and run a native Worker that displays `Hello, world`.
For a KV-backed application with a Server Function, see the [Alchemy Basic example](../../examples/basic/) and its [Worker entry](../../examples/basic/src/entry.workers.ts).

## Key features

- Provide Alchemy resources to request-local Effront services through a native Worker.
- Keep typed failures visible until the Worker maps them to an HTTP response.

## Prerequisites

- **Compatibility**: Alchemy and its Cloudflare runtime `2.0.0-beta.79`, with a coherent Effect `4.0.0-rc.116` family across application and host. See [compatibility rationale](docs/INTEGRATION.md#compatibility) before upgrades.
- **Host**: The pinned CLI requires a configured Cloudflare profile, even for local planning. Run the application with `alchemy dev`, not bare Vite.

## Setup

Install the adapter and matching host dependencies:

```sh
vp add @effront/alchemy@0.1.4 alchemy@2.0.0-beta.79 effect@4.0.0-rc.116 @effront/core@0.1.4 @effront/vite@0.1.4
```

Use the [core runtime peer requirements](../core/README.md#setup) for React and `@effect/platform-browser`.
The adapter imports are `@effront/alchemy/cloudflare` and `@effront/alchemy/cloudflare/vite`.

## API

The [Alchemy API reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/alchemy) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/alchemy)) covers deferred HTTP handlers, capability capture, and the Vite adapter.
See [package API links](docs/API.md) and [integration architecture](docs/INTEGRATION.md) for maintainer details.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
