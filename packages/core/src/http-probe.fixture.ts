import { Context, Effect, Layer, MutableRef, Stream } from "effect";
import type { Scope } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import type { ApplicationDefinition } from "./application/definition.tsx";
import { Application } from "./application/effront.ts";
import { External } from "./http-external.fixture.ts";
import { platformRequest } from "./http-request.fixture.ts";
import { makeHttpEffect } from "./http.ts";

export class RequestResource extends Context.Service<
  RequestResource,
  Readonly<{ label: string }>
>()("effront/test/http/RequestResource") {}

export type Acquisition = Readonly<{
  label: string;
  released: MutableRef.MutableRef<number>;
  scope: Scope.Scope;
}>;

type ProbeResponse = Effect.Effect<HttpServerResponse.HttpServerResponse>;
type Respond = (acquisition: Acquisition) => ProbeResponse;
type ProbeRequirements = External | HttpServerRequest.HttpServerRequest | HttpRouter.HttpRouter;
type ProbeApplication = ApplicationDefinition<RequestResource, never, ProbeRequirements>;

export const encoder = new TextEncoder();
const streamResponse = (acquisition: Acquisition): ProbeResponse => {
  const first = Stream.make(encoder.encode(acquisition.label));
  const body = Stream.concat(first, Stream.never);
  return Effect.succeed(HttpServerResponse.stream(body));
};

const EFFRONT = Application.effront<RequestResource>();
const shell = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
const page = EFFRONT.Page.make({ render: () => Effect.succeed("") });

const initialReleases = 0;
const acquisitionLayer = (
  acquisitions: Acquisition[],
  respond: Respond,
): Layer.Layer<RequestResource, never, ProbeRequirements> =>
  Layer.effect(
    RequestResource,
    Effect.gen(function* () {
      const external = yield* External;
      const native = yield* HttpServerRequest.HttpServerRequest;
      const scope = yield* Effect.scope;
      const acquisition = {
        label: `${external.label}:${native.headers["x-request-id"]}`,
        released: MutableRef.make(initialReleases),
        scope,
      };
      acquisitions.push(acquisition);
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => MutableRef.increment(acquisition.released)),
      );
      const router = yield* HttpRouter.HttpRouter;
      yield* router.add("GET", "/probe", respond(acquisition));
      return { label: acquisition.label };
    }),
  );

export const makeProbeApplication = (
  acquisitions: Acquisition[],
  respond: Respond = streamResponse,
): ProbeApplication =>
  EFFRONT.make({
    layer: acquisitionLayer(acquisitions, respond),
    routes: EFFRONT.Routes.make({ layout: shell }).page("/", page),
  });

const capture = Effect.fnUntraced(function* (application: ProbeApplication) {
  const stale = platformRequest("stale");
  return yield* makeHttpEffect(application).pipe(
    Effect.provideService(External, { label: "captured" }),
    Effect.provideService(HttpServerRequest.HttpServerRequest, stale),
    Effect.scoped,
  );
});

export const releaseCounts = (acquisitions: Acquisition[]): number[] =>
  acquisitions.map(({ released }) => MutableRef.get(released));

export const captureHandler = Effect.fnUntraced(function* (application: ProbeApplication) {
  return HttpEffect.toWebHandler(yield* capture(application));
});
