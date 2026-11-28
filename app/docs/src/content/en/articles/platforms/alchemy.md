## Prepare the example {#setup}

Install the current Node.js LTS and [Vite+](https://viteplus.dev/).

> [!IMPORTANT]
> The example pins Alchemy to `2.0.0-beta.81`, whose CLI requires a configured Cloudflare profile even for local development.
> Before you start the application, complete the profile setup in the [Alchemy documentation](https://alchemy.run/docs).

```bash
vp create effront -- my-app --platform alchemy-cloudflare
cd my-app
vp install
```

## Find the application and resource definitions {#worker}

The one-page example already contains the host configuration:

| File                    | Role                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the document layout, one page, and its `/` route.                             |
| `src/entry.workers.ts`  | Exports the named Worker and constructs its configured HTTP handler.                  |
| `alchemy.run.ts`        | Defines the Stack and outputs the Worker's URL.                                       |
| `vite.config.ts`        | Registers `effront()` and sets the Workers module with `effrontAlchemy({ workers })`. |
| `package.json`          | Defines `dev` as `alchemy dev`.                                                       |

Use the same setup for [multiple Workers](../api-reference/alchemy.md#multiple-workers). Export each Worker by name from the Workers module and include all of them in the Stack.

## Start development {#stack}

From the generated project, run:

```bash
vp run dev
```

When ready, open the local URL printed by Alchemy. The single page displays `Hello, world`.
Change `<h1>Hello, world</h1>` in `src/entry.effront.tsx` to `<h1>Hello, Effront!</h1>`.
Save the file.

## Add resources when needed {#capabilities}

For application services using resources such as KV and D1, follow [Alchemy Basic](https://github.com/totto2727-org/effront/tree/main/examples/basic), [Alchemy's resource APIs](https://alchemy.run/docs), and the [Effront Alchemy API reference](../api-reference/alchemy.md).
