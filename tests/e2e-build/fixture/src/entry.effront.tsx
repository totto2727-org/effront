import { Effect } from "effect";
import { EFFRONT } from "./effront.ts";
import { ExampleShell } from "./example-shell.tsx";
import { HostLive } from "./greeting-host.ts";
import { getWorkersRequestContext } from "./host.ts";
import { pages } from "./manual-pages.ts";
import { manualRoutes } from "./manual-routes.fixture.tsx";
import { RichComponentsPage, ServerOverridesPage } from "./rich-markdown.fixture.tsx";
import { transitionRoutes } from "./transition-routes.fixture.tsx";
import { AboutPage, HomePage } from "./worker-pages.fixture.tsx";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.gen(function* () {
      const { request } = yield* getWorkersRequestContext();
      const path = new URL(request.url).pathname.replace(/\/$/u, "");
      const matched = pages.find((page) => page.href === path);
      return (
        <html lang="en">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>{matched ? `${matched.title} | Effront` : "Effront Workers"}</title>
          </head>
          <body>
            <ExampleShell>{children}</ExampleShell>
          </body>
        </html>
      );
    }),
});

const application = EFFRONT.make({
  layer: HostLive,
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/about", AboutPage)
    .page("/manual-server-only", ServerOverridesPage)
    .page("/rich-components", RichComponentsPage)
    .mount("/transitions", transitionRoutes)
    .mount("/manual", manualRoutes),
});

// oxlint-disable-next-line import/no-default-export -- The Effront Vite plugin reads the fixture's application from its default export.
export default application;
