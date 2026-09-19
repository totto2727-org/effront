# @effront/alchemy

This experimental adapter connects Effront applications to native Alchemy Cloudflare Workers so construction-time capabilities can provide request-local services for streamed pages and Server Functions.

## Usage

Use the [native Alchemy example](../../examples/alchemy/src/entry.workers.ts) to serve `Hello from Alchemy KV` from a request-local service backed by an Alchemy KV binding, then invoke its greeting Server Function from the browser.
Pair that Worker with its [stack](../../examples/alchemy/alchemy.run.ts), [Vite configuration](../../examples/alchemy/vite.config.ts), and [application](../../examples/alchemy/src/entry.effront.tsx) for the complete integration.
Register `plugins: [effront(), effrontAlchemy()]`, importing `effront` from `@effront/vite` and `effrontAlchemy` from `@effront/alchemy/cloudflare/vite`.
The compiler owns the React, RSC, SSR, and browser graphs and accepts `application`; the Alchemy adapter accepts only `worker` and adds the native bridge and runtime compilation settings.
Its `CacheClient` holds an Alchemy-native client, while only the resulting label and greeting reach the rendered page.
This capability boundary still depends on Alchemy's client type and is not a provider-independent cache abstraction.

The official CLI path uses `alchemy dev` orchestration, which injects the host and runtime stack bindings.
With the pinned beta, even local CLI planning requires a configured Cloudflare profile.
If it reports `Provider 'Cloudflare' is not configured in profile 'default'`, configure that profile before retrying rather than supplying fake credentials.
The separate local test host does not establish that Alchemy CLI planning is authentication-free.
The pinned development host has a [reproduced runtime failure](docs/INTEGRATION.md#compatibility) after planning; a configured profile does not resolve it, and passing production build/preview checks do not establish working development.

## Key features

- Defer RSC application imports until a Worker request rather than loading them during infrastructure evaluation.
- Capture capability references during native Worker construction and acquire application Layers per request.
- Preserve typed application failures for handling at the HTTP boundary.
- Add Alchemy's official native Worker bridge to the separately registered Effront compiler integration.
- Support the pinned Worker and native KV runtime APIs with explicit compatibility limits.

## Prerequisites

- **Compatibility**: Alchemy and its Cloudflare runtime `2.0.0-beta.77`, with a coherent Effect `4.0.0-rc.112` family across the application and host.
- **Toolchain**: VitePlus, matching core React peers, and a native Alchemy Worker configured for the `rsc` entry and `ssr` child environment.

## Setup

After version `0.1.4` is published, install the adapter and matching host dependencies:

```sh
vp add @effront/alchemy@0.1.4 alchemy@2.0.0-beta.77 effect@4.0.0-rc.112 @effront/core@0.1.4 @effront/vite@0.1.4
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
