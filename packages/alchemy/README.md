# @effront/alchemy

Serve Effront pages and Server Functions on Alchemy Cloudflare Workers with request-local Effect services.

## Usage

The [native Worker example](../../examples/basic/src/entry.workers.ts) supplies a KV client to an Effront application.
Its home page renders `Hello from Alchemy KV`, and its browser button calls a greeting Server Function using the same request-local service.
Use its [stack](../../examples/basic/alchemy.run.ts), [Vite configuration](../../examples/basic/vite.config.ts), and [application](../../examples/basic/src/entry.effront.tsx) together.

Register the compiler before the Alchemy adapter:

```ts
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [effront(), effrontAlchemy()] });
```

Start native applications through `alchemy dev`, not bare Vite.
Alchemy supplies the host and stack bindings, so do not add a second Cloudflare runtime plugin.
If local planning reports `Provider 'Cloudflare' is not configured in profile 'default'`, configure that profile before retrying.
See [compatibility limits](docs/INTEGRATION.md#compatibility) before changing Alchemy or Effect versions.

## Key features

- Use Alchemy resource clients in request-local application services.
- Retain request resources while pages stream and Server Functions execute.
- Handle typed application failures at the HTTP boundary.

## Prerequisites

- **Compatibility**: Alchemy and its Cloudflare runtime `2.0.0-beta.79`, with a coherent Effect `4.0.0-rc.116` family across the application and host.
- **Host**: A configured Cloudflare profile is required for the pinned CLI, including local planning.

## Setup

Install the adapter and matching host dependencies:

```sh
vp add @effront/alchemy@0.1.4 alchemy@2.0.0-beta.79 effect@4.0.0-rc.116 @effront/core@0.1.4 @effront/vite@0.1.4
```

Use the [core runtime peer requirements](../core/README.md#setup) for React and `@effect/platform-browser`.
The adapter imports are `@effront/alchemy/cloudflare` and `@effront/alchemy/cloudflare/vite`.

## API

The [Alchemy API guide](docs/API.md) covers `ApplicationLoader`, `applicationHttpEffect`, `makeApplicationHttpEffect`, `effrontAlchemy`, their options, construction-capability capture, and consumer-selected Alchemy capabilities.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
