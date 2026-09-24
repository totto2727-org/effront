import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { GreetingAction } from "./features/greeting/client";
import { Host, HostLive } from "./features/greeting/services";
import { Counter } from "./components/counter";
import { Shell } from "./components/shell";
import { loadingRoutes } from "./features/loading/routes";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Effront Workers</title>
        </head>
        <body className="m-8 bg-slate-50 font-sans text-blue-950">
          <Shell>{children}</Shell>
        </body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const host = yield* Host;
    return (
      <>
        <h1 className="my-5 text-3xl font-bold">Hello, world!</h1>
        <p className="my-4" data-testid="kv-greeting">
          {host.greeting}
        </p>
        <p className="my-4">React Server Components on Workers, powered by Effect.</p>
        <Counter />
        <GreetingAction />
      </>
    );
  }),
});

const AboutPage = EFFRONT.Page.make({
  render: Effect.fn("AboutPage.render")(function* () {
    const host = yield* Host;
    return (
      <>
        <h1 className="my-5 text-3xl font-bold">About</h1>
        <p className="my-4" data-testid="label">
          {host.label}
        </p>
        <a className="text-blue-700 underline" href="/">
          Back home
        </a>
      </>
    );
  }),
});

export default EFFRONT.make({
  layer: HostLive,
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/about", AboutPage)
    .mount("/loading", loadingRoutes),
});
