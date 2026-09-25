## Prepare the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).

> [!IMPORTANT]
> The example pins Alchemy to `2.0.0-beta.77`, whose CLI requires a configured Cloudflare profile even for local development.
> Complete the profile setup in the [Alchemy documentation](https://alchemy.run/docs) before starting the app.

```bash
vp create effront -- my-app --platform alchemy-cloudflare
cd my-app
vp install
```

## Find the application and resource definitions {#worker}

The one-page example already contains the host configuration:

| File                    | Role                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the document layout, one page, and its `/` route.               |
| `src/entry.workers.ts`  | Declares the Worker and defers loading the application until a request. |
| `alchemy.run.ts`        | Defines the Stack and outputs the Worker's URL.                         |
| `vite.config.ts`        | Registers `effront()` and `effrontAlchemy()`.                           |
| `package.json`          | Defines `dev` as `alchemy dev`.                                         |

## Start development {#stack}

From the generated project, run:

```bash
vp run dev
```

When ready, open the local URL printed by Alchemy. The single page displays `Hello, world`.
Change `<h1>Hello, world</h1>` in `src/entry.effront.tsx` to `<h1>Hello, Effront!</h1>` and save.

## Add resources when needed {#capabilities}

The minimal Worker does not declare a KV binding or a fixed development port. For resource-backed application services, follow [Alchemy Basic](https://github.com/totto2727-org/effront/tree/main/examples/basic), [Alchemy's resource APIs](https://alchemy.run/docs), and the [Effront Alchemy API reference](../api-reference/alchemy.md).
