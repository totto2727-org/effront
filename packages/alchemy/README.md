# @effront/alchemy

This private experimental adapter connects Effront applications to native Alchemy Cloudflare Workers so construction-time capabilities can provide request-local services for streamed pages and Server Functions.

## Usage

Use the [native Alchemy example](../../examples/alchemy/src/entry.workers.ts) to serve `Hello from Alchemy KV` from a request-local service backed by an Alchemy KV binding, then invoke its greeting Server Function from the browser.
Pair that Worker with its [stack](../../examples/alchemy/alchemy.run.ts), [Vite configuration](../../examples/alchemy/vite.config.ts), and [application](../../examples/alchemy/src/entry.effront.tsx) for the complete integration.
Its `CacheClient` holds an Alchemy-native client, while only the resulting label and greeting reach the rendered page.
This capability boundary still depends on Alchemy's client type and is not a provider-independent cache abstraction.

The supported CLI path uses `alchemy dev` orchestration, which injects the host and runtime stack bindings.
With the pinned beta, even local CLI planning requires a configured Cloudflare profile.
If it reports `Provider 'Cloudflare' is not configured in profile 'default'`, configure that profile before retrying rather than supplying fake credentials.
The separate local test host does not establish that Alchemy CLI planning is authentication-free.

## Key features

- Defer RSC application imports until a Worker request rather than loading them during infrastructure evaluation.
- Capture capability references during native Worker construction and acquire application Layers per request.
- Preserve typed application failures for handling at the HTTP boundary.
- Compose browser, RSC, and SSR compilation with Alchemy's official native Worker bridge.
- Support the pinned Worker and native KV runtime APIs with explicit compatibility limits.

## Prerequisites

- **Local adapter**: a prepared Effront checkout with installed dependencies and built package exports; this private prototype is not available from npm.
- **Compatibility**: Alchemy and its Cloudflare runtime `2.0.0-beta.77`, with a coherent Effect `4.0.0-rc.112` family across the application and host.
- **Toolchain**: VitePlus, matching core React peers, and a native Alchemy Worker configured for the `rsc` entry and `ssr` child environment.

## Setup

Install the matching host dependencies and public Effront integrations:

```sh
vp add alchemy@2.0.0-beta.77 effect@4.0.0-rc.112 @effront/core@0.1.1 @effront/vite@0.1.1
```

Link the prepared adapter into that VitePlus consumer application using its absolute local path:

```sh
vp link /absolute/path/to/effront/packages/alchemy
```

Use the [core runtime peer requirements](../core/README.md#setup) for React and `@effect/platform-browser`.
The adapter imports are `@effront/alchemy/cloudflare` and `@effront/alchemy/cloudflare/vite`.

## API

The [Alchemy API guide](docs/API.md) covers `ApplicationLoader`, `applicationHttpEffect`, `makeApplicationHttpEffect`, `effrontAlchemy`, their options, construction-capability capture, and consumer-selected Alchemy capabilities.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](../../LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
