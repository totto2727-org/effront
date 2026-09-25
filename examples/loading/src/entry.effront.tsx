import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { loadingRoutes } from "./features/loading/routes";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Effront Loading / Suspense</title>
        </head>
        <body className="m-8 bg-slate-50 font-sans text-blue-950">
          <main className="max-w-3xl">{children}</main>
        </body>
      </html>,
    ),
});

const Home = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <section>
        <h1 className="my-5 text-3xl font-bold">Loading / Suspense</h1>
        <a className="text-blue-700 underline" href="/loading">
          実験室を開く
        </a>
      </section>,
    ),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", Home)
    .mount("/loading", loadingRoutes),
});
