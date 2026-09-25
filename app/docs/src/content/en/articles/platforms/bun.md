Start with the [minimal Bun example](https://github.com/totto2727-org/effront/tree/main/examples/bun) or `vp create effront -- my-app --platform bun`.
For navigation and richer features, see [Alchemy Basic](https://github.com/totto2727-org/effront/tree/main/examples/basic). The former richer Bun application is retained only as a [server test fixture](https://github.com/totto2727-org/effront/tree/main/tests/e2e-server/fixtures/bun).

## Run the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).
Also install [Bun 1.4.2 or later](https://bun.sh/docs/installation) for the production server.
Vite development uses Node.js, so keep both runtimes installed.
Clone the repository and install its dependencies:

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
cd examples/bun
vp dev
```

Open the local URL printed by Vite. The single page displays `Hello, world`.

## Find the application and server files {#entries}

The example already contains the host configuration.
Start with these files when changing the page or the way the server runs:

| File                    | Role                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the document layout, one page, and its `/` route.                    |
| `src/entry.rsc.ts`      | Exports the application's HTTP `handler`.                                    |
| `src/entry.server.ts`   | Starts the Bun listener with `@effront/server/bun` and `BunRuntime.runMain`. |
| `vite.config.ts`        | Registers `effront()` and `effrontServer()`.                                 |
| `package.json`          | Lists dependencies and the `start` command.                                  |

Change `<h1>Hello, world</h1>` in `src/entry.effront.tsx` to `<h1>Hello, Effront!</h1>` and save. The page updates without restarting the server.

## Check the production build locally {#assets}

Stop development, then run these commands from `examples/bun`:

```bash
vp build
```

The build puts the server entry in `dist/rsc/server.js` and generated browser assets in `dist/client/assets`.
`src/entry.server.ts` serves those assets at `/assets/`.

## Start the Bun server {#bun}

After the build, run from `examples/bun`:

```bash
vp run start
```

The script runs `bun dist/rsc/server.js`.
With `PORT` and `HOST` unset, open [http://127.0.0.1:3000](http://127.0.0.1:3000).
This URL serves the built application on Bun.
To change the listening address, set `PORT` and `HOST` before starting the server.

The minimal example uses `@effect/platform-bun` in production and `@effect/platform-node` for development.

For listener and asset options, see the [server API reference](../api-reference/server.md).
See the separate [Node.js example](./node.md) for that runtime.
