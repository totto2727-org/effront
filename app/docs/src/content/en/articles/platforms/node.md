Start with the [minimal Node.js example](https://github.com/totto2727-org/effront/tree/main/examples/node) or `vp create effront -- my-app --platform node`.
For navigation, counters, and other features beyond the one-page starter, see [Alchemy Basic](https://github.com/totto2727-org/effront/tree/main/examples/basic). The richer Node.js application is retained only as a [server test fixture](https://github.com/totto2727-org/effront/tree/main/tests/e2e-server/fixtures/node).

## Run the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).
Create a Node.js project and install its dependencies:

```bash
vp create effront -- my-app --platform node
cd my-app
vp install
vp dev
```

Open the local URL printed by Vite. The single page displays `Hello, world`.

## Find the application and server files {#entries}

The example already contains the host configuration:

| File                    | Role                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the document layout, one page, and its `/` route.                          |
| `src/entry.rsc.ts`      | Exports the application's HTTP `handler` for development and production.           |
| `src/entry.server.ts`   | Starts the Node.js listener with `@effront/server/node` and `NodeRuntime.runMain`. |
| `vite.config.ts`        | Registers `effront()` and `effrontServer()`.                                       |
| `package.json`          | Lists dependencies and the `start` command.                                        |

Change `<h1>Hello, world</h1>` in `src/entry.effront.tsx` to `<h1>Hello, Effront!</h1>` and save. The page updates without restarting the server.

## Check the production build locally {#assets}

Stop development, then run from the generated project:

```bash
vp build
```

The build puts the server entry in `dist/rsc/server.js` and generated browser assets in `dist/client/assets`.
`src/entry.server.ts` serves those assets at `/assets/`.

## Start the Node.js server {#node}

After the build, run from `examples/node`:

```bash
vp run start
```

The script runs `node dist/rsc/server.js`.
With `PORT` and `HOST` unset, open [http://127.0.0.1:3000](http://127.0.0.1:3000).
To change the listening address, set `PORT` and `HOST` before starting the server.

For listener and asset options, see the [server API reference](../api-reference/server.md).
See the separate [Bun example](./bun.md) for that runtime.
