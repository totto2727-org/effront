## Run the example {#setup}

Install the current Node.js LTS and [Vite+](https://viteplus.dev/).
Also install the [current Bun release](https://bun.sh/docs/installation) for the production server.
Vite development uses Node.js, so keep both runtimes installed.
Create a Bun project and install its dependencies:

```bash
vp create effront -- my-app --platform bun
cd my-app
vp install
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

Change `<h1>Hello, world</h1>` in `src/entry.effront.tsx` to `<h1>Hello, Effront!</h1>`.
Save the file.
The page updates without a server restart.

## Check the production build locally {#assets}

Stop development.
Then run these commands from the generated project:

```bash
vp build
```

The build puts the server entry in `dist/rsc/server.js` and generated browser assets in `dist/client/assets`.
`src/entry.server.ts` serves those assets at `/assets/`.

## Start the Bun server {#bun}

After the build, run from the generated project:

```bash
vp run start
```

The script runs `bun dist/rsc/server.js`.
With `PORT` and `HOST` unset, open [http://127.0.0.1:3000](http://127.0.0.1:3000).
This URL serves the built application on Bun.
Before you start the server, set `PORT` and `HOST` to change the listening address.

The minimal example uses `@effect/platform-bun` in production and `@effect/platform-node` for development.

For listener and asset options, see the [server API reference](../api-reference/server.md).
See the separate [Node.js example](./node.md) for that runtime.
