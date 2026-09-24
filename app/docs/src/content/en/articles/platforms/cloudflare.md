Start with the [one-page standalone Cloudflare starter](https://github.com/totto2727-org/effront/tree/main/examples/minimal/cloudflare) or `vp create effront -- my-app --platform cloudflare`.
This guide covers the separate [standalone Workers feature example](https://github.com/totto2727-org/effront/tree/main/examples/workers), which exercises the independent host adapter and its Wrangler build.

## Run the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/), then run:

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
cd examples/workers
vp dev
```

Open the local URL printed by Vite.
The homepage displays `Hello, world!` and `Hello from Cloudflare Workers`.
Click `Count: 0` to check that the counter increments.

## Find the Worker configuration {#vite}

The example includes the files needed to run on Workers:

| File                    | Role                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the pages, root layout, and routes.                                                    |
| `src/entry.workers.ts`  | Exports the Fetch handler created by `createFetchHandler(application)`.                        |
| `vite.config.ts`        | Registers `effront()` and `effrontCloudflare()`, adds Tailwind, and fixes the development URL. |
| `wrangler.jsonc`        | Sets the Worker entry, compatibility settings, `ASSETS` binding, and application variables.    |
| `package.json`          | Lists the adapter, Wrangler, and application dependencies.                                     |

Edit page content in `src/entry.effront.tsx`.
Keep the existing `nodejs_compat` flag and `ASSETS` binding when changing Wrangler settings.
See the [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/) for other options.

## Run the built Worker with Wrangler {#local}

Stop development, then run these commands from `examples/workers`:

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787).
The generated configuration loads the built Worker and its browser assets, rather than the source entry in `wrangler.jsonc`.
These local commands do not deploy the example or require Cloudflare authentication.

## Read Worker bindings and request context {#context}

Use the accessors inside request-scoped Effects, such as a Page, Server Function, or application Layer served by `createFetchHandler`.
For a Worker with an `API_ORIGIN` variable, this helper reads the binding and request URL, and passes an audit task to `waitUntil()`:

```typescript
import { getWorkersEnv, getWorkersRequestContext } from "@effront/cloudflare/workers";
import { Effect } from "effect";

type Env = { API_ORIGIN: string };

export const readRequestSettings = Effect.fn("app/readRequestSettings")(function* (
  recordAccess: (path: string) => Promise<void>,
) {
  const env = yield* getWorkersEnv<Env>();
  const { request, executionContext } = yield* getWorkersRequestContext<Env>();
  const path = new URL(request.url).pathname;
  executionContext.waitUntil(recordAccess(path));
  return { apiOrigin: env.API_ORIGIN, path };
});
```

Configure `API_ORIGIN` in your Worker and supply your own `recordAccess` function when calling this helper from an Effect.

> [!WARNING]
> The type argument describes host values but does not validate them.
> Do not render or return secret bindings to the browser.

The factory binds `Env` once, so its reader calls need no type arguments:

```typescript
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";
import { Effect } from "effect";

type Env = { API_ORIGIN: string };
const workers = createWorkersContextAccessors<Env>();

export const currentRequest = Effect.gen(function* () {
  const env = yield* workers.getWorkersEnv();
  const { request } = yield* workers.getWorkersRequestContext();
  return { apiOrigin: env.API_ORIGIN, path: new URL(request.url).pathname };
});
```

See the [Workers context reference](../api-reference/workers.md#cloudflare) for the full contract.

<span id="secrets"></span>

For credentials rather than display text, use [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/) instead of `vars`.

## Manage resources with Alchemy {#alchemy}

To define the Worker and its resources in code, start with the separate [Alchemy example](./alchemy.md).
