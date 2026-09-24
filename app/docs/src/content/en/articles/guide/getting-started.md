Run a minimal Effront application that displays `Hello, world`, then explore the files that make up the page.

## Run the sample {#setup}

Install Node.js 24.11 or later, [pnpm](https://pnpm.io/installation), and [Vite+](https://viteplus.dev/), then create a Node.js starter:

```bash
pnpm create effront my-app --platform node
cd my-app
pnpm install
pnpm dev
```

Open the local URL printed by the development server. The page displays `Hello, world`.
Choose `--platform bun` for Bun or `--platform cloudflare` for a Cloudflare Worker managed by Alchemy. The latter requires a configured Alchemy Cloudflare profile even for local development. All three starters contain the same page code; only the host setup differs.

If you are working within the Effront repository instead, run `vp install` at its root and start the matching [Node](https://github.com/totto2727-org/effront/tree/main/examples/hello-world), [Bun](https://github.com/totto2727-org/effront/tree/main/examples/hello-world-bun), or [Cloudflare](https://github.com/totto2727-org/effront/tree/main/examples/hello-world-cloudflare) example.

## Explore the sample {#application}

The Node.js starter has one page and five principal files:

| File                    | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the page content, its HTML layout, and the `/` route.       |
| `src/entry.rsc.ts`      | Connects the application to the development and production servers. |
| `src/entry.server.ts`   | Starts the Node.js server for a production build.                   |
| `vite.config.ts`        | Configures Effront development and builds.                          |
| `package.json`          | Lists dependencies and commands for running the example.            |

The page is defined in `src/entry.effront.tsx` of the generated project (also available in the [Node example](https://github.com/totto2727-org/effront/blob/main/examples/hello-world/src/entry.effront.tsx)).
`HomePage` contains the displayed heading, `RootLayout` provides the surrounding HTML, and `Routes` makes the page available at `/`.

## Change the heading {#run}

In `src/entry.effront.tsx`, change the heading:

```tsx
const HomePage = EFFRONT.Page.make({
  // Replace the heading text.
  render: () => Effect.succeed(<h1>Hello, Effront</h1>),
});
```

Save the file.
The browser updates to display `Hello, Effront`.
To add another page, continue with [Pages, layouts, and routes](./routes.md).
