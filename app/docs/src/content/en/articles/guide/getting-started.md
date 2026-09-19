Create a homepage, give it a URL, and run it in your browser.
This walkthrough uses a local Cloudflare Worker so you can try a complete Effront application before adding more pages or application services.
If you already have another runtime in mind, use the corresponding [platform guide](../platforms.md) for its setup.

## Prepare your project {#setup}

Use a VitePlus project as the starting point and run the following commands in its application directory.
For VitePlus installation and initial project setup, see the [VitePlus guide](https://viteplus.dev/guide/).

```bash
vp add @effront/core@0.1.4 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0 react-dom@19.3.0
vp add -D @effront/vite@0.1.4 @effront/cloudflare@0.1.4 @vitejs/plugin-rsc@0.5.35 wrangler
```

Keep the React and Effect versions compatible with Effront's peer dependencies if you change these pins.
The RSC integration also requires `@vitejs/plugin-rsc` as an explicit development dependency.

## Define the homepage {#application}

Create `src/entry.effront.tsx` with the following contents.
An Effront page's `render` function returns an Effect containing React content.
For this static heading, `Effect.succeed` is enough.

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

The final `.page("/", HomePage)` gives the page its URL, while `RootLayout` places its content inside the HTML document.
The default export brings those definitions together as an application.
Keep the Layout, Page, and Routes attached to the same `EFFRONT` value, including when you later move them into separate files.

## Connect the application to Workers {#files}

Your application now describes a page, but it still needs an entry point that accepts HTTP requests.
Create `src/entry.workers.ts` to expose the application's Fetch handler to Workers.

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

Add `vite.config.ts` at the project root so Vite can build the application for this host.
These plugins use the entry filenames shown above by default.

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

Although `@vitejs/plugin-rsc` must be installed, you should not add it to this list yourself.
The `effront()` integration registers both the RSC and React plugins.

Add `wrangler.jsonc` alongside the Vite configuration to name the Worker and select its entry point.
Keep the `ASSETS` binding so Workers can serve the browser files from your build.

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

## See the result and make it your own {#run}

Run the development server from the same application directory.

```bash
vp dev
```

Open the URL printed in the terminal.
The homepage should show `Hello, Effront`.
Replace that text in `HomePage`, save the file, and reload the page to check your own content.
You now have a place to build your application: edit the page for its content and the layout for the document that surrounds it.

To try the built application rather than the development server, stop `vp dev` and run:

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

Use the generated `dist/rsc/wrangler.json` here because it describes the built Worker, rather than the source entry in your original configuration.
Open the URL printed by Wrangler and check the homepage again.

Choose your next step based on what you want to change: [Routing](./routes.md) adds pages and URLs, while [Styling](./styling.md) changes their appearance.
For environment variables and other Workers settings, continue with the [Cloudflare guide](/en/platforms/cloudflare).
