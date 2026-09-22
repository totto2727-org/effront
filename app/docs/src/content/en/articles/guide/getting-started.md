Run a minimal Effront application that displays `Hello, world`, then explore the files that make up the page.

## Run the sample {#setup}

With Node.js 24.11 or later and [Vite+](https://viteplus.dev/) installed, clone the [Hello world example](https://github.com/totto2727-org/effront/tree/main/examples/hello-world):

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
```

Then start the sample:

```bash
cd examples/hello-world
vp dev
```

Open [http://127.0.0.1:1340](http://127.0.0.1:1340).
The page displays `Hello, world`.
For later development sessions, run `vp dev` from `examples/hello-world`.

## Explore the sample {#application}

The example has one page and uses Node.js to run locally.
Its five files have these roles:

| File                    | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `src/entry.effront.tsx` | Defines the page content, its HTML layout, and the `/` route.       |
| `src/entry.rsc.ts`      | Connects the application to the development and production servers. |
| `src/entry.server.ts`   | Starts the Node.js server for a production build.                   |
| `vite.config.ts`        | Configures Effront development and builds.                          |
| `package.json`          | Lists dependencies and commands for running the example.            |

The page is defined in [`src/entry.effront.tsx`](https://github.com/totto2727-org/effront/blob/main/examples/hello-world/src/entry.effront.tsx).
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
