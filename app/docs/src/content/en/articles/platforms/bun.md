Run the [Bun example](https://github.com/totto2727-org/effront/tree/main/examples/bun) in development, then build and start its Bun HTTP server.

## Run the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).
Also install [Bun 1.4.2 or later](https://bun.sh/docs/installation) for the production server.
Vite development and preview use Node.js, so keep both runtimes installed.
Clone the repository and build its workspace packages before starting the example:

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/bun
vp dev
```

Open [http://127.0.0.1:1342](http://127.0.0.1:1342).
The homepage displays `Hello, world!`.
Click `Count: 0` to check that the counter increments, then follow **About** to [http://127.0.0.1:1342/about](http://127.0.0.1:1342/about).

## Find the application and server files {#entries}

The example already contains the host configuration.
Start with these files when changing the page or the way the server runs:

| File                    | Role                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the root layout, pages, and routes.                                                             |
| `src/entry.rsc.ts`      | Exports the application's HTTP `handler` and accepts development updates.                               |
| `src/entry.server.ts`   | Starts the Bun listener with `@effront/server/bun` and `BunRuntime.runMain`.                            |
| `vite.config.ts`        | Registers `effront()` and `effrontServer()`, adds Tailwind, and fixes the development and preview URLs. |
| `package.json`          | Lists dependencies and the `start` command.                                                             |

Edit the heading in `src/entry.effront.tsx` and save.
The page at [http://127.0.0.1:1342](http://127.0.0.1:1342) updates without restarting the server.

## Check the production build locally {#assets}

Stop development, then run these commands from `examples/bun`:

```bash
vp build
vp preview
```

Open [http://127.0.0.1:4342](http://127.0.0.1:4342) to check the built pages and browser assets.
This is Vite preview, not the Bun production listener.

The build puts the server entry in `dist/rsc/server.js`, generated JavaScript and CSS in `dist/client/assets`, and public files in `dist/client`.
`src/entry.server.ts` already mounts the generated assets at `/assets/` and public files at their exact paths.

## Start the Bun server {#bun}

Stop preview and run:

```bash
vp run start
```

The script runs `bun dist/rsc/server.js`.
With `PORT` and `HOST` unset, open [http://127.0.0.1:3000](http://127.0.0.1:3000).
This URL serves the built application on Bun.
To change the listening address, set `PORT` and `HOST` before starting the server.

Test Bun-specific behavior with this command, not `vp preview`, which uses Node-compatible Vite middleware.
The example uses `@effect/platform-bun` in production and `@effect/platform-node` for development.

For listener and asset options, see the [server API reference](../api-reference/server.md).
See the separate [Node.js example](./node.md) for that runtime.
