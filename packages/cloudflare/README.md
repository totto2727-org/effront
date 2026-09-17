# @effront/cloudflare

Cloudflare Workers integration for Effront lets you run React Server Components and SSR in workerd and read typed environment bindings inside request Effects.

## Usage

Render pages using Cloudflare Workers rather than a Node SSR process by registering both integrations in `vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

With a [core application and Fetch entry](../core/README.md#usage) and a Wrangler binding `vars: { APP_LABEL: "Greeting Worker" }`, read that binding in a request Effect:

```ts
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";
import { Effect } from "effect";

const { getWorkersEnv } = createWorkersContextAccessors<{ APP_LABEL: string }>();
export const greeting = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  return `Hello from ${env.APP_LABEL}`;
});
```

A Page or request Layer that evaluates `greeting` receives `Hello from Greeting Worker`, which it can render into the HTML response.
The [standalone Workers example](../../examples/workers/README.md#usage) provides the complete runnable application and Wrangler configuration.
The Fetch handler comes from `@effront/core/workers`; import request accessors from `@effront/cloudflare/workers` to avoid loading the Vite plugin in your Worker.

## Key features

- Execute the `rsc` Worker environment and its `ssr` child in workerd.
- Nest default SSR output inside the Worker upload directory while preserving explicit output paths.
- Forward Cloudflare Vite options while keeping Effront's required environment wiring intact.
- Read typed bindings and the Cloudflare execution context through the existing request-local core Context.

## Prerequisites

- **Application**: configure `@effront/core` and the matching `@effront/vite` integration with compatible Effect peers.
- **Toolchain**: use VitePlus or a compatible Vite installation and a Cloudflare Worker configuration.
- **Deployment**: Cloudflare credentials are required when publishing to Cloudflare; local workerd usage does not require an account.

## Setup

```sh
npm install @effront/core@0.1.1 @effront/cloudflare@0.1.1
npm install --save-dev @effront/vite@0.1.1 @vitejs/plugin-rsc@0.5.34 vite-plus@0.3.1
```

Install the [core runtime peers](../core/README.md#setup) as well.
The Cloudflare Vite plugin is included as this package's dependency.

## API

### `effrontCloudflare(options?)` and `EffrontCloudflareOptions`

Import these from `@effront/cloudflare` for build configuration.
The function returns Vite plugins and must be registered alongside `effront()`, as shown in Usage.
`EffrontCloudflareOptions` accepts the installed `@cloudflare/vite-plugin` options except `viteEnvironment`, which is fixed to the `rsc` Worker and its `ssr` child.

```ts
import { effrontCloudflare, type EffrontCloudflareOptions } from "@effront/cloudflare";

const options: EffrontCloudflareOptions = {};
const plugins = effrontCloudflare(options);
```

The default SSR output is `<rsc output>/ssr`, with RSC output defaulting to `<build.outDir or dist>/rsc`.
An explicit `environments.ssr.build.outDir` is preserved and must remain available to the host's Worker artifact.
Other options pass through unchanged, including persistence, remote bindings, and Wrangler configuration selection.
Server ports and Wrangler configuration discovery retain Cloudflare defaults.

### `createWorkersContextAccessors<Env>()`

Import from `@effront/cloudflare/workers` to obtain `getWorkersEnv()` and `getWorkersRequestContext()` Effects with one shared Env type:

```ts
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<{
  APP_LABEL: string;
}>();
```

Both readers use the existing core request Context without creating a service or Layer and preserve host object identity.
Omitted Env defaults to `unknown`.
Types describe host values without validating them at runtime.
Use them during `createFetchHandler` request processing; outside that context, the core accessor reports a wiring `TypeError`.

### `getWorkersEnv<Env>()`, `getWorkersRequestContext<Env>()`, and `CloudflareExecutionContext`

The same runtime subpath exposes ready-to-use readers when a shared factory is unnecessary:

```ts
import { getWorkersEnv, getWorkersRequestContext } from "@effront/cloudflare/workers";
import { Effect } from "effect";

const requestLabel = Effect.gen(function* () {
  const env = yield* getWorkersEnv<{ APP_LABEL: string }>();
  const { request, executionContext } = yield* getWorkersRequestContext();
  executionContext.waitUntil(Promise.resolve());
  return `${request.method}: ${env.APP_LABEL}`;
});
```

For a GET with the binding from Usage, `requestLabel` returns `GET: Greeting Worker`.
`CloudflareExecutionContext` is the exported minimal contract `{ waitUntil(promise: Promise<unknown>): void }`.
The context reader returns `{ env, request, executionContext }` with this fixed execution-context type.
For a custom execution-context type as well as Env, use [`createWorkersContextAccessors<Env, ExecutionContext>()` from core](../core/docs/API.md#fetch-and-request-context).

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE).
See [third-party notices](THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
