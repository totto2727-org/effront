import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, Layer, MutableRef } from "effect";
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/http";

import { Application } from "./application/effront.ts";
import { External } from "./http-external.fixture.ts";
import { platformRequest, request } from "./http-request.fixture.ts";
import { makeHttpEffect, toHttpEffect } from "./http.ts";

const EFFRONT = Application.effront<External>();
const shell = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
const page = EFFRONT.Page.make({ render: () => Effect.succeed("") });

const external = { label: "direct" };
const forwardingHandler = Effect.gen(function* () {
  const forwarded: External["Service"][] = [];
  const middleware = EFFRONT.Middleware.make(() =>
    Effect.gen(function* () {
      const service = yield* External;
      forwarded.push(service);
      return HttpServerResponse.text(service.label);
    }),
  );
  const routes = EFFRONT.withMiddleware(middleware)
    .Routes.make({ layout: shell })
    .page("/probe", page);
  const app = EFFRONT.make({ layer: Layer.effect(External, External), routes });
  const http = yield* makeHttpEffect(app).pipe(Effect.provideService(External, external));
  return { forwarded, handle: HttpEffect.toWebHandler(http) };
});

class AcquisitionFailure extends Data.TaggedError("AcquisitionFailure")<
  Readonly<{ message: string }>
> {}

const failAcquisition = Effect.fn("effront.test.failHttpServiceAcquisition")(function* (
  failure: AcquisitionFailure,
  released: MutableRef.MutableRef<number>,
) {
  const layer = Layer.effect(
    External,
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() => Effect.sync(() => MutableRef.increment(released)));
      return yield* Effect.fail(failure);
    }),
  );
  const routes = EFFRONT.Routes.make({ layout: shell }).page("/probe", page);
  const app = EFFRONT.make({ layer, routes });
  const native = platformRequest("failure");
  return yield* toHttpEffect(app).pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, native),
    Effect.flip,
    Effect.scoped,
  );
});

describe("services in native application middleware", () => {
  it.effect("passes the host service into the middleware without creating a second instance", () =>
    Effect.gen(function* () {
      const { forwarded, handle } = yield* forwardingHandler;
      const response = yield* Effect.promise(async () => handle(request("forwarded")));
      const text = yield* Effect.promise(async () => response.text());
      expect(forwarded).toHaveLength(1);
      expect(forwarded[0]).toBe(external);
      expect(text).toBe("direct");
    }),
  );

  it.effect(
    "preserves typed acquisition failures and closes partially acquired application layers",
    () =>
      Effect.gen(function* () {
        const released = MutableRef.make(0);
        const failure = new AcquisitionFailure({ message: "acquisition failed" });
        const observed = yield* failAcquisition(failure, released);
        expect(observed).toBe(failure);
        expect(MutableRef.get(released)).toBe(1);
      }),
  );
});
