# @effront/vite

Build Effront applications with React Server Components, server-rendered HTML, browser hydration, and the native React Compiler through a portable Vite integration.

## Usage

Serve a server-rendered home page with an interactive counter, then navigate to an About page without replacing the application shell.
The [Workers application's concrete routes](../../examples/workers/src/entry.effront.tsx) and [Vite configuration](../../examples/workers/vite.config.ts) demonstrate this integration: requesting `/` renders `Hello, world!`, and its client counter becomes interactive after hydration.
See the [Workers example Usage](../../examples/workers/README.md#usage) for the complete consumer flow.

## Key features

- Configures the browser, React Server Component, and SSR environments together.
- Enables the native React Compiler and supplies Effront's browser and SSR entrypoints.
- Supports custom host and application entry paths.
- Refreshes RSC raw-content imports during development, including document deletion.

## Prerequisites

- **Application**: An Effront application with a matching `@effront/core` version.
- **Tooling**: Vite with environment support, such as VitePlus, and its supported Node.js runtime.
- **Host integration**: A runtime adapter that hosts RSC and SSR environments. Cloudflare Workers is the tested standalone host.

## Setup

Install the integration and its core peer in your Vite application:

```bash
npm install @effront/core@0.1.1
npm install --save-dev @effront/vite@0.1.1 vite
```

For the standalone Workers configuration below, also install its host integration:

```bash
npm install --save-dev @effront/cloudflare@0.1.1
```

## API

### `effront(options?: EffrontViteOptions)`

Returns a Vite `PluginOption[]` configuring Effront's React and RSC integrations.
Register it once alongside your host integration:

```ts
import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

The plugin owns the React and Vite RSC plugins, so do not register them a second time.
It does not install or register a host adapter, and Node and Bun adapters are not implemented.
For the experimental native Alchemy integration, register `plugins: [effront(), effrontAlchemy()]` with `effrontAlchemy` from `@effront/alchemy/cloudflare/vite`; see the [Alchemy setup and compatibility limits](../alchemy/README.md).
Keep application-entry configuration on `effront({ application })`; the Alchemy adapter accepts only `worker` and replaces the RSC input with its native bridge.

### `EffrontViteOptions`

- `rsc?: string`: The RSC environment's host entry exporting a `{ fetch }` handler. Defaults to `./src/entry.workers.ts`.
- `application?: string`: The application definition entry exposed through `@effront/core/application-entry`. Defaults to `./src/entry.effront.tsx` and resolves relative to the Vite root.

```ts
import { effront, type EffrontViteOptions } from "@effront/vite";

const entries: EffrontViteOptions = {
  rsc: "./src/host.ts",
  application: "./src/application.tsx",
};

effront(entries);
```

The application definition remains in the RSC graph; the integration supplies the browser and SSR entries.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
