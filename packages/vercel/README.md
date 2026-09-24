# @effront/vercel

Build an Effront application for Vercel's Node.js runtime using Vite and the Build Output API v3.
Local build and native HTTP behavior are tested; hosted deployment and Vercel-specific cancellation behavior require separate validation.

## Usage

Register the adapter after `effront()`, instead of `effrontServer()`:

```ts
import { effront } from "@effront/vite";
import { effrontVercel } from "@effront/vercel/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontVercel()],
});
```

Keep the same native Effect HTTP entry used by the Node adapter:

```ts
// src/entry.rsc.ts
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
if (import.meta.hot) import.meta.hot.accept();
```

`vp build` writes `.vercel/output/config.json`, static files, and one Node.js function containing both RSC and SSR graphs.
The adapter owns `dist/vercel/{client,rsc,ssr}` and `.vercel/output`; add `.vercel/` to the application's `.gitignore`.
`vp dev` and `vp preview` use the native Node adapter and do not emulate the Vercel platform.

## Key features

- Preserves Vite's separate RSC, SSR, and browser graphs without Bun or Rspack.
- Bundles server dependencies and serves browser/public output before the application catch-all.
- Uses native Node request/response streaming without opening a listener in the deployed function.
- Stages deployment output and restores the previous output if replacement fails.

## Prerequisites

- An Effront application using the Node-compatible native Effect HTTP entry.
- Node.js 22 for the generated function, with Vite or VitePlus for building.
- A Vercel project and authentication for deployment, not for local builds or tests.

## Setup

```bash
vp add @effront/vercel @effront/server @effront/core @effront/vite @effect/platform-node effect
```

For a Vercel project, use the Other framework preset and the application's usual Vite build command.
Review Vercel's [Build Output API](https://vercel.com/docs/build-output-api) before deploying the generated output.

## API

### `effrontVercel(options?)`

Exported from `@effront/vercel/vite`.
Returns Vite plugins and accepts `rsc?: string`, defaulting to `./src/entry.rsc.ts`.
The entry must export a named native Effect `handler`; the adapter generates the default Node request/response export for Vercel.
Vite `base` must be `/`.
Do not register another host adapter alongside it.

The generated function uses `runtime: "nodejs22.x"`, `launcherType: "Nodejs"`, `handler: "rsc/server.js"`, and `supportsResponseStreaming: true`, as specified by the [Build Output primitives](https://vercel.com/docs/build-output-api/primitives#node.js-config).
The handler follows Vercel's [Node.js request/response contract](https://vercel.com/docs/functions/runtimes/node-js).

### Limits

This adapter bundles JavaScript dependencies rather than tracing the filesystem.
Non-builtin external modules are rejected during the server build.
Native addons, dynamic `require`, runtime-selected imports, and arbitrary filesystem reads are not automatically packaged.
Use Vite-imported assets or an external service for application data, not a local writable database.
Only built client/public files become public, and public files take precedence over application routes.

Vercel imposes function duration, bundle size, and resource limits independently of local Node behavior.
Streaming can keep a function invocation active and incur provider charges.
There is no deployment, paid resource provisioning, or credential access during an adapter build.
Local client-disconnect cleanup does not establish that Vercel propagates disconnects; Vercel requires cancellation to be enabled per route.

## Development

See [AGENTS.md](AGENTS.md) for package maintenance and validation.

## License

[MIT](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
