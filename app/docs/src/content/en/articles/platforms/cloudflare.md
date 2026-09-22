Run the [Cloudflare Workers example](https://github.com/totto2727-org/effront/tree/main/examples/workers) locally with Vite, then check the built Worker with Wrangler.
The example uses `@effront/cloudflare` and does not require Alchemy.

## Run the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/), then run:

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/workers
vp dev
```

Open [http://127.0.0.1:1343](http://127.0.0.1:1343).
The homepage displays `Hello, world!` and `Hello from Cloudflare Workers`.
Click `Count: 0` to check that the counter increments.

## Find the Worker configuration {#vite}

The example includes the files needed to run on Workers:

| File                    | Role                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the pages, root layout, and routes.                                                                 |
| `src/entry.workers.ts`  | Exports the Fetch handler created by `createFetchHandler(application)`.                                     |
| `vite.config.ts`        | Registers `effront()` and `effrontCloudflare()`, adds Tailwind, and fixes the development and preview URLs. |
| `wrangler.jsonc`        | Sets the Worker entry, compatibility settings, `ASSETS` binding, and application variables.                 |
| `package.json`          | Lists the adapter, Wrangler, and application dependencies.                                                  |

Edit page content in `src/entry.effront.tsx`.
Keep the existing `nodejs_compat` flag and `ASSETS` binding when changing Wrangler settings.
See the [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/) for other options.

## Preview the built Worker {#local}

Stop development, then run these commands from `examples/workers`:

```bash
vp build
vp preview
```

Open [http://127.0.0.1:4343](http://127.0.0.1:4343) and check the counter and greeting form.
To run the built Worker independently of Vite, stop preview and use the generated Wrangler configuration:

```bash
vp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787).
The generated configuration loads the built Worker and its browser assets, rather than the source entry in `wrangler.jsonc`.
These local commands do not deploy the example or require Cloudflare authentication.

## Change an application variable {#context}

In `wrangler.jsonc`, change the existing `APP_LABEL` value to `My Effront App`.
Keep `GREETING` and the other settings unchanged.
Restart `vp dev`, then open [http://127.0.0.1:1343/about](http://127.0.0.1:1343/about) to see `My Effront App`.

`src/features/greeting/services.ts` reads the variables through `getWorkersEnv` and provides them to the pages as a `Host` service.
`APP_LABEL` appears on the About page; `GREETING` appears on the homepage and in the greeting Server Function.
For access to the request or `waitUntil()`, see the [Workers context accessors](../api-reference/workers.md).

<span id="secrets"></span>

For credentials rather than display text, use [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/) instead of `vars`.

## Manage resources with Alchemy {#alchemy}

To define the Worker and its resources in code, start with the separate [Alchemy example](./alchemy.md).
