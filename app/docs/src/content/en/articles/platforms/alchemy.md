Use the [Alchemy example](https://github.com/totto2727-org/effront/tree/main/examples/alchemy) to develop an Effront application with a Cloudflare Worker managed by Alchemy.
The host configuration is already included, so you can start the application before changing its pages.

## Prepare the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).
The example pins Alchemy to `2.0.0-beta.77`, whose CLI requires a configured Cloudflare profile even for local development.
Complete the profile setup in the [Alchemy documentation](https://alchemy.run/docs) before starting the app.

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/alchemy
```

## Find the application and resource definitions {#worker}

For the initial setup, focus on these files rather than recreating its configuration:

| File                    | Role                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the pages, root layout, and routes. Start here to change page content.   |
| `src/entry.workers.ts`  | Declares the Worker, connects the application, and sets development port `1337`. |
| `alchemy.run.ts`        | Defines the Stack, uses local management state, and outputs the Worker's URL.    |
| `vite.config.ts`        | Registers `effront()` and `effrontAlchemy()` alongside Tailwind.                 |
| `package.json`          | Pins dependencies and defines `dev` as `alchemy dev`.                            |

## Start development {#stack}

From `examples/alchemy`, run:

```bash
vp run dev
```

Once the CLI reports that it is ready, open [http://localhost:1337](http://localhost:1337).
The homepage displays `Hello, world!`.

Edit the heading in `src/entry.effront.tsx` and save to check development updates.

## Add resources when needed {#capabilities}

For additional resources, see [Alchemy's resource APIs](https://alchemy.run/docs) and the [Effront Alchemy API reference](../api-reference/alchemy.md).
