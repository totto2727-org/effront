import { createFetchHandler, createWorkersContextAccessors } from "@effront/core/workers";
import { Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import type { FetchHandler } from "#core/workers.ts";
// oxlint-disable-next-line rules/consistent-import-extension, import/no-relative-parent-imports -- Exercise the packed react-server entry without changing ordinary Vitest resolution.
import { Application } from "../../dist/core.js";

class Greeting extends Context.Service<
  Greeting,
  Readonly<{ message: (name: string) => Effect.Effect<string> }>
>()("effront/tests/userland-http/Greeting") {}

type RequestEnvironmentKey = "effront/tests/userland-http/RequestEnvironment";
const RequestEnvironment = Context.Service<
  RequestEnvironmentKey,
  Readonly<{ requestId: string; url: string; value: string }>
>("effront/tests/userland-http/RequestEnvironment");

type RequestInfoKey = "effront/tests/userland-http/RequestInfo";
const RequestInfo = Context.Service<RequestInfoKey, Readonly<{ url: string }>>(
  "effront/tests/userland-http/RequestInfo",
);

const workers = createWorkersContextAccessors<
  Readonly<{ value: string }>,
  Readonly<{ requestId: string }>
>();

const accepted = 202;
const greetingLayer = Layer.succeed(Greeting, {
  message: (name) => Effect.succeed(`こんにちは、${name} さん。`),
});

const captureEnvironment = Effect.fnUntraced(function* (events: string[]) {
  return yield* Effect.acquireRelease(
    Effect.gen(function* () {
      const { env, executionContext, request } = yield* workers.getWorkersRequestContext();
      events.push(`acquired:${executionContext.requestId}`);
      return { requestId: executionContext.requestId, url: request.url, value: env.value };
    }),
    ({ requestId }) =>
      Effect.sync(() => {
        events.push(`released:${requestId}`);
      }),
  );
});

const { use: registerRoutes } = HttpRouter;
const greetingApi = registerRoutes(
  Effect.fnUntraced(function* (router) {
    const greeting = yield* Greeting;
    const environment = yield* RequestEnvironment;
    yield* router.add(
      "GET",
      "/api/greeting",
      Effect.map(greeting.message("Ada"), (message) => HttpServerResponse.jsonUnsafe({ message })),
    );
    yield* router.add(
      "GET",
      "/api/status",
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        return HttpServerResponse.jsonUnsafe(
          { ...environment, method: request.method },
          { status: accepted },
        );
      }),
    );
  }),
);
const globalHeaders = HttpRouter.middleware(
  (httpEffect) =>
    Effect.map(httpEffect, HttpServerResponse.setHeader("x-content-type-options", "nosniff")),
  { global: true },
);
const nativeRoutes = Layer.mergeAll(greetingApi, globalHeaders);

const scopedResponse = Effect.gen(function* () {
  const requestInfo = yield* RequestInfo;
  const greeting = yield* Greeting;
  const environment = yield* RequestEnvironment;
  const message = yield* greeting.message("Ada");
  return HttpServerResponse.jsonUnsafe({
    message,
    ...environment,
    scopedUrl: requestInfo.url,
  }).pipe(HttpServerResponse.setHeader("x-application-scoped", "yes"));
});

type ApplicationFixture = Readonly<{ events: string[]; handler: FetchHandler }>;

export const makeApplication = (): ApplicationFixture => {
  const events: string[] = [];
  const services = Layer.mergeAll(
    greetingLayer,
    Layer.effect(RequestEnvironment, captureEnvironment(events)),
  );
  const EFFRONT = Application.effront<Greeting | RequestEnvironmentKey>();
  const ProvideRequestInfo = EFFRONT.Middleware.make<{ provides: RequestInfoKey }>((httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      return yield* httpEffect.pipe(Effect.provideService(RequestInfo, { url: request.url }));
    }),
  );
  const Scoped = EFFRONT.withMiddleware(ProvideRequestInfo);
  const Respond = Scoped.Middleware.make(() => scopedResponse);
  const Layout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
  const Page = EFFRONT.Page.make({
    render: () => Effect.die("Pure HTTP tests must not invoke Flight or HTML rendering."),
  });
  const app = EFFRONT.make({
    layer: nativeRoutes.pipe(Layer.provideMerge(services)),
    routes: Scoped.withMiddleware(Respond).Routes.make({ layout: Layout }).page("/page", Page),
  });
  return { events, handler: createFetchHandler(app) };
};
