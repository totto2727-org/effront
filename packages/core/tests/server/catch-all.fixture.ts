import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";

import { Application } from "#core/core.ts";
import type { FetchHandler } from "#core/workers.ts";
import { createFetchHandler } from "#core/workers.ts";

const reportedRoute = Effect.map(HttpRouter.RouteContext, ({ route, params }) =>
  HttpServerResponse.text(JSON.stringify({ params, pattern: route.path })),
);
const unexpectedRender = Effect.die("Request middleware must respond.");

// The real Effront router must delegate matching to the same native HTTP layer.
export const makeHandler = (): FetchHandler => {
  const App = Application.effront();
  const Respond = App.Middleware.make(() => reportedRoute);
  const Layout = App.Layout.make({ render: ({ children }) => Effect.succeed(children) });
  const PathPage = App.Page.make({
    params: Schema.Struct({ path: Schema.String }),
    render: () => unexpectedRender,
  });
  const SlugPage = App.Page.make({
    params: Schema.Struct({ slug: Schema.String }),
    render: () => unexpectedRender,
  });
  const NestedPage = App.Page.make({
    params: Schema.Struct({ lang: Schema.String, path: Schema.String }),
    render: () => unexpectedRender,
  });
  const StaticPage = App.Page.make({ render: () => unexpectedRender });
  const routes = App.withMiddleware(Respond)
    .Routes.make({ layout: Layout })
    .mount("/manual", App.Routes.make().page("/*path", PathPage))
    .page("/manual/about", StaticPage)
    .page("/manual/:slug", SlugPage)
    .page("/localized/:lang/*path", NestedPage)
    .page("/plain", StaticPage)
    .page("/日本語/入門", StaticPage);
  return createFetchHandler(App.make({ routes }));
};

const nativePaths = [
  "/manual/*",
  "/manual/about",
  "/manual/:slug",
  "/localized/:lang/*",
  "/plain",
  "/日本語/入門",
] as const;

type NativeHandler = Readonly<{
  dispose: () => Promise<void>;
  handler: (request: Request) => Promise<Response>;
}>;

const forbidden = 403;

const nativeRoute = (
  path: (typeof nativePaths)[number],
): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  Layer.mergeAll(
    HttpRouter.add("GET", path, reportedRoute),
    HttpRouter.add(
      "POST",
      path,
      HttpServerResponse.text("Rejected a cross-origin Server Function request.", {
        status: forbidden,
      }),
    ),
  );

// POSTs without Origin must reach the existing Server Function guard.
export const makeNativeHandler = (): NativeHandler => {
  const [first, ...rest] = nativePaths;
  return HttpRouter.toWebHandler(
    Layer.mergeAll(nativeRoute(first), ...rest.map((path) => nativeRoute(path))),
    { disableLogger: true },
  );
};

export const makeValidationHandler = (): FetchHandler => {
  const App = Application.effront();
  const Layout = App.Layout.make({ render: ({ children }) => Effect.succeed(children) });
  const Page = App.Page.make({
    params: Schema.Struct({ path: Schema.Literal("allowed") }),
    render: () => Effect.die("Invalid parameters must not render."),
  });
  return createFetchHandler(
    App.make({ routes: App.Routes.make({ layout: Layout }).page("/manual/*path", Page) }),
  );
};
