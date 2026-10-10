Run a minimal Effront application that displays `Hello, world`.
Then examine the files that define the page.

## Run the sample {#setup}

The current Node.js LTS, [Bun](https://bun.com/), and [Vite+](https://viteplus.dev/) are required.

```bash
vp create effront -- my-app --platform node
cd my-app
vp install
vp dev
```

Open the local URL printed by the development server. The page displays `Hello, world`.
For other configurations, refer to [Platforms](../platforms.md).

## Explore the sample {#application}

The Node.js starter has one page and five primary files:

| File                    | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the page content, its HTML layout, and the `/` route.       |
| `src/entry.rsc.ts`      | Connects the application to the development and production servers. |
| `src/entry.server.ts`   | Starts the Node.js server for a production build.                   |
| `vite.config.ts`        | Configures Effront development and builds.                          |
| `package.json`          | Lists dependencies and commands for running the example.            |

The generated project's `src/entry.effront.tsx` defines the page (also available in the [Node example](https://github.com/totto2727-org/effront/blob/main/examples/node/src/entry.effront.tsx)).
`HomePage` contains the displayed heading.
`RootLayout` supplies the surrounding HTML.
`Routes` makes the page available at `/`.

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
