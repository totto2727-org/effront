Run the [Node.js example](https://github.com/totto2727-org/effront/tree/main/examples/node) in development, then build and start its Node.js HTTP server.

## Run the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).
Clone the repository and build its workspace packages before starting the example:

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/node
vp dev
```

Open [http://127.0.0.1:1341](http://127.0.0.1:1341).
The homepage displays `Hello, world!`.
Click `Count: 0` to check that the counter increments, then follow **About** to [http://127.0.0.1:1341/about](http://127.0.0.1:1341/about).

## Find the application and server files {#entries}

The example already contains the host configuration.
Start with these files when changing the page or the way the server runs:

| File                    | Role                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the root layout, pages, and routes.                                                             |
| `src/entry.rsc.ts`      | Exports the application's HTTP `handler` and accepts development updates.                               |
| `src/entry.server.ts`   | Starts the Node.js listener with `@effront/server/node` and `NodeRuntime.runMain`.                      |
| `vite.config.ts`        | Registers `effront()` and `effrontServer()`, adds Tailwind, and fixes the development and preview URLs. |
| `package.json`          | Lists dependencies and the `start` command.                                                             |

Edit the heading in `src/entry.effront.tsx` and save.
The page at [http://127.0.0.1:1341](http://127.0.0.1:1341) updates without restarting the server.

## Check the production build locally {#assets}

Stop development, then run these commands from `examples/node`:

```bash
vp build
vp preview
```

Open [http://127.0.0.1:4341](http://127.0.0.1:4341) to check the built pages and browser assets.
This is Vite preview, not the Node.js production listener.

The build puts the server entry in `dist/rsc/server.js`, generated JavaScript and CSS in `dist/client/assets`, and public files in `dist/client`.
`src/entry.server.ts` already mounts the generated assets at `/assets/` and public files at their exact paths.

## Start the Node.js server {#node}

Stop preview and run:

```bash
vp run start
```

The script runs `node dist/rsc/server.js`.
With `PORT` and `HOST` unset, open [http://127.0.0.1:3000](http://127.0.0.1:3000).
This URL serves the built application on Node.js.
To change the listening address, set `PORT` and `HOST` before starting the server.

For listener and asset options, see the [server API reference](../api-reference/server.md).
See the separate [Bun example](./bun.md) for that runtime.
