Create a homepage that displays `Hello, Effront`, then run it on your chosen host.

## Prepare your project {#setup}

In a [VitePlus project](https://viteplus.dev/guide/), install Effront and its shared dependencies:

```bash
vp add @effront/core@0.1.4 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0 react-dom@19.3.0
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35
```

If you change these versions, keep them aligned with Effront's [peer dependencies](../api-reference.md#versions).

## Define the homepage {#application}

Create `src/entry.effront.tsx`:

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>
          <main>{children}</main>
        </body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Hello, Effront</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});
```

The `render` callback returns an Effect containing the heading.
`RootLayout` surrounds the page with the HTML document, and `.page("/", HomePage)` assigns it the homepage URL.
Create the Layout, Page, and Routes from the same `EFFRONT` value, even if you move them into separate files.

## Connect the application to a host {#files}

Follow one [platform setup](../platforms.md) to add the host entry and `vite.config.ts`, then start its development server:

- [Cloudflare Workers](../platforms/cloudflare.md#setup): run locally with Wrangler configuration and no Cloudflare account for this example.
- [Node.js / Bun](../platforms/node-bun.md#setup): use Vite for development and a native server for production.
- [Alchemy](../platforms/alchemy.md#setup): manage a Worker and its resources in code, with a configured Cloudflare profile.

## See the result and make it your own {#run}

Open the development URL printed in the terminal and visit `/`.
The page should show `Hello, Effront`.
Change that text in `HomePage`, save, and reload to see your new heading.
