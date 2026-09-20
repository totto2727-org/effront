# @effront/cloudflare

Serve Effront applications on Cloudflare Workers and read typed bindings in request Effects.

## Usage

Register both plugins in `vite.config.ts`:

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

A Page that evaluates `greeting` can render `Hello from Greeting Worker`.
The [standalone Workers example](../../examples/workers/README.md#usage) provides the complete runnable application and Wrangler configuration.
The Fetch handler comes from `@effront/core/workers`; import request accessors from `@effront/cloudflare/workers` to avoid loading the Vite plugin in your Worker.

## Key features

- Execute the `rsc` Worker environment and its `ssr` child in workerd.
- Configure Wrangler selection, persistence, and other Cloudflare Vite options.
- Read typed bindings and the Cloudflare execution context in request Effects.

## Prerequisites

- **Application**: configure `@effront/core` and the matching `@effront/vite` integration with compatible Effect peers.
- **Host configuration**: a Wrangler configuration with the application's entry and bindings.
- **Deployment**: Cloudflare credentials are required when publishing to Cloudflare; local workerd usage does not require an account.

## Setup

```sh
npm install @effront/core@0.1.4 @effront/cloudflare@0.1.4
npm install --save-dev @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35 vite-plus@0.3.1
```

Install the [core runtime peers](../core/README.md#setup) as well.
The Cloudflare Vite plugin is included as this package's dependency.

## API

### `effrontCloudflare(options?)` and `EffrontCloudflareOptions`

Import from `@effront/cloudflare`.
The function returns Vite plugins to register alongside `effront()`, as shown in Usage.
`EffrontCloudflareOptions` accepts the installed `@cloudflare/vite-plugin` options except `viteEnvironment`, which is fixed to the `rsc` Worker and its `ssr` child.

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

Both readers preserve host object identity.
Omitted Env defaults to `unknown`.
Types describe host values without validating them at runtime.
Use them during `createFetchHandler` request processing; outside that context, the core accessor reports a wiring `TypeError`.

### `getWorkersEnv<Env>()`, `getWorkersRequestContext<Env>()`, and `CloudflareExecutionContext`

Use the direct readers when you do not need a shared Env type:

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

For a GET request, `requestLabel` returns `GET: Greeting Worker`.
`CloudflareExecutionContext` is the exported minimal contract `{ waitUntil(promise: Promise<unknown>): void }`.
The context reader returns `{ env, request, executionContext }` with this fixed execution-context type.
For a custom execution-context type as well as Env, use [`createWorkersContextAccessors<Env, ExecutionContext>()` from core](../core/docs/API.md#fetch-and-request-context).

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE).
See [third-party notices](THIRD-PARTY-NOTICES.md).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
