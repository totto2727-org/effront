Start with the [one-page Node.js starter](https://github.com/totto2727-org/effront/tree/main/examples/hello-world) or `pnpm create effront my-app --platform node`.
This guide uses the richer [Node.js example](https://github.com/totto2727-org/effront/tree/main/examples/node) to demonstrate navigation and server behavior in development and production.

## Run the example {#setup}

Install Node.js 24.11 or later and [Vite+](https://viteplus.dev/).
Clone the repository and install its dependencies:

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
cd examples/node
vp dev
```

Open [http://127.0.0.1:1341](http://127.0.0.1:1341).
The homepage displays `Hello, world!`.
Click `Count: 0` to check that the counter increments, then follow **About** to [http://127.0.0.1:1341/about](http://127.0.0.1:1341/about).

## Find the application and server files {#entries}

The example already contains the host configuration.
Start with these files when changing the page or the way the server runs:

| File                    | Role                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `src/entry.effront.tsx` | Defines the root layout, pages, and routes.                                                |
| `src/entry.rsc.ts`      | Exports the application's HTTP `handler` and accepts development updates.                  |
| `src/entry.server.ts`   | Starts the Node.js listener with `@effront/server/node` and `NodeRuntime.runMain`.         |
| `vite.config.ts`        | Registers `effront()` and `effrontServer()`, adds Tailwind, and fixes the development URL. |
| `package.json`          | Lists dependencies and the `start` command.                                                |

Change the heading in `src/entry.effront.tsx`, then save to display `Hello, Effront!`:

```tsx
return (
  <>
    {/* Replace the heading text. */}
    <h1 className="my-5 text-3xl font-bold">Hello, Effront!</h1>
    {/* Keep the remaining page content unchanged. */}
  </>
);
```

The page at [http://127.0.0.1:1341](http://127.0.0.1:1341) updates without restarting the server.

## Check the production build locally {#assets}

Stop development, then run these commands from `examples/node`:

```bash
vp build
```

The build puts the server entry in `dist/rsc/server.js`, generated JavaScript and CSS in `dist/client/assets`, and public files in `dist/client`.
`src/entry.server.ts` already mounts the generated assets at `/assets/` and public files at their exact paths.

## Start the Node.js server {#node}

After the build, run from `examples/node`:

```bash
vp run start
```

The script runs `node dist/rsc/server.js`.
With `PORT` and `HOST` unset, open [http://127.0.0.1:3000](http://127.0.0.1:3000).
This URL serves the built application on Node.js.
To change the listening address, set `PORT` and `HOST` before starting the server.

For listener and asset options, see the [server API reference](../api-reference/server.md).
See the separate [Bun example](./bun.md) for that runtime.
