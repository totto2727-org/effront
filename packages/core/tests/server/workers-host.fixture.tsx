import { expect } from "@effect/vitest";
import { Context, Effect, Layer, Stream } from "effect";
import { HttpServerResponse } from "effect/http";

import { Application } from "#core/application/effront.ts";
import type { FetchHandler } from "#core/workers.ts";
import {
  createFetchHandler,
  createWorkersContextAccessors,
  getWorkersRequestContext,
} from "#core/workers.ts";
import { lifetimeLayer, RequestLifetime } from "./workers-lifetime.fixture.ts";

class RequestEnvironment extends Context.Service<RequestEnvironment, Readonly<{ value: string }>>()(
  "effront/tests/workers/RequestEnvironment",
) {}

export type TestEnv = Readonly<{ mode?: "empty" | "failure" | "stream"; value: string }>;

const accessors = createWorkersContextAccessors<TestEnv, Readonly<{ requestId: string }>>();
const encoder = new TextEncoder();

const failure = (): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.error(new DOMException("intentional stream failure", "Error"));
    },
  });

const unfinished = (value: string): ReadableStream<Uint8Array> => {
  const pending = Promise.withResolvers<undefined>();
  return new ReadableStream({
    async pull(controller) {
      controller.enqueue(encoder.encode(value));
      return pending.promise;
    },
  });
};

const streamResponse = (
  evaluate: () => ReadableStream<Uint8Array>,
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.stream(Stream.fromReadableStream({ evaluate, onError: (cause) => cause }));

const respond = Effect.gen(function* () {
  const environment = yield* RequestEnvironment;
  const lifetime = yield* RequestLifetime;
  const requestContext = yield* accessors.getWorkersRequestContext();
  expect(requestContext).toBe(yield* getWorkersRequestContext());

  if (requestContext.env.mode === "empty") {
    return HttpServerResponse.empty();
  }
  if (requestContext.env.mode === "failure") {
    return streamResponse(failure);
  }
  return requestContext.env.mode === "stream"
    ? streamResponse(() => unfinished(environment.value))
    : HttpServerResponse.text(
        `${environment.value}|${requestContext.executionContext.requestId}|${requestContext.request.url}`,
      ).pipe(HttpServerResponse.setHeader("x-events", lifetime.events.join(",")));
});

const environmentLayer = Layer.effect(
  RequestEnvironment,
  Effect.map(accessors.getWorkersEnv(), ({ value }) => RequestEnvironment.of({ value })),
);

export const makeWorker = (events: string[]): FetchHandler => {
  const EFFRONT = Application.effront<RequestEnvironment | RequestLifetime>();
  const Respond = EFFRONT.Middleware.make(() => respond);
  const Layout = EFFRONT.Layout.make({
    render: ({ children }) => Effect.succeed(<html lang="en">{children}</html>),
  });
  const Page = EFFRONT.Page.make({
    render: () => Effect.die("Workers test middleware must short-circuit rendering."),
  });
  const routes = EFFRONT.withMiddleware(Respond).Routes.make({ layout: Layout }).page("/", Page);
  const layer = Layer.mergeAll(environmentLayer, lifetimeLayer(events));
  return createFetchHandler(EFFRONT.make({ layer, routes }));
};
