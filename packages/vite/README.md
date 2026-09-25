# @effront/vite

Compile Effront pages for server rendering, browser hydration, and client navigation with Vite.

## Usage

Register `effront()` with your host adapter in `vite.config.ts`.
For standalone Cloudflare Workers:

```ts
import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

The [Workers application's routes](../../examples/workers/src/entry.effront.tsx) render `Hello, world!` at `/`, hydrate a counter, and navigate to About without replacing the shared shell.
Use its [Vite configuration](../../examples/workers/vite.config.ts) and [complete setup](../../examples/workers/README.md#usage) to run that application.

## Key features

- Configures the browser, React Server Component, and SSR environments together.
- Enables the native React Compiler and supplies Effront's browser and SSR entrypoints.
- Enables Effect Schema's lazy JIT in the framework-owned SSR and browser entries and the RSC entry selected by `effront({ rsc })` with Effect 4.0.0-rc.116.
- Supports custom host and application entry paths.
- Refreshes RSC raw-content imports during development, including document deletion.

## Prerequisites

- **Application**: An Effront application with a matching `@effront/core` version.
- **Tooling**: A Node.js runtime supported by your Vite installation.
- **Host integration**: An explicit runtime adapter for RSC and SSR, such as the Cloudflare Workers integration below or the [native Node/Bun server integration](../server/README.md).

## Setup

Install the integration and its core peer in your Vite application:

```bash
npm install @effront/core@0.1.4
npm install --save-dev @effront/vite@0.1.4 vite
```

For the standalone Workers configuration below, also install its host integration:

```bash
npm install --save-dev @effront/cloudflare@0.1.4
```

## API

### `effront(options?: EffrontViteOptions)`

Returns a Vite `PluginOption[]` configuring Effront's React and RSC integrations.
Register it once alongside a host adapter, as in Usage.
It includes the React and Vite RSC plugins, so do not register them separately.
For native Node or Bun HTTP hosting, register `plugins: [effront(), effrontServer()]` with `effrontServer` from `@effront/server/vite`; see the [server package setup and runtime boundaries](../server/README.md).
For Alchemy, register `plugins: [effront(), effrontAlchemy()]` with `effrontAlchemy` from `@effront/alchemy/cloudflare/vite`; see the [Alchemy setup and compatibility limits](../alchemy/README.md).
Keep application-entry configuration on `effront({ application })`; the Alchemy adapter accepts only `worker`.

### `EffrontViteOptions`

- `rsc?: string`: The RSC environment's host entry, with exports defined by the host adapter. Defaults to the Workers `{ fetch }` entry at `./src/entry.workers.ts`; `effrontServer()` replaces this input with its native HTTP handler entry.
- `application?: string`: The application definition entry exposed through `@effront/core/application-entry`. Defaults to `./src/entry.effront.tsx` and resolves relative to the Vite root.

```ts
import { effront, type EffrontViteOptions } from "@effront/vite";

const entries: EffrontViteOptions = {
  rsc: "./src/host.ts",
  application: "./src/application.tsx",
};

effront(entries);
```

The application definition remains in the RSC graph, while the integration supplies the browser and SSR entries.
Those framework-owned entries import Effect Schema JIT directly, while `effront()` adds it to the RSC entry selected by its `rsc` option.
When `effrontServer()` selects a different RSC entry, specify the same path in `effront({ rsc })` to enable JIT there.
See [Schema JIT registration](docs/SCHEMA-JIT.md) for the graph boundaries, native host imports, and interpreter fallback.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
