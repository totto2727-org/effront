import { describe, expect, expectTypeOf, it, test } from "@effect/vitest";
import { Context, Effect } from "effect";
import { HttpEffect } from "effect/http";

import type { ApplicationRequirements, ApplicationServices } from "./application/definition.tsx";
import { External } from "./http-external.fixture.ts";
import {
  captureHandler,
  makeProbeApplication,
  releaseCounts,
  RequestResource,
} from "./http-probe.fixture.ts";
import type { Acquisition } from "./http-probe.fixture.ts";
import { cancelBody, request } from "./http-request.fixture.ts";
import { makeHttpEffect, toHttpEffect } from "./http.ts";

describe("captured external services", () => {
  test("retains application services and external requirements in the types", () => {
    const application = makeProbeApplication([]);
    const services: ApplicationServices<typeof application> = RequestResource;
    const external: ApplicationRequirements<typeof application> = External;
    const construction = makeHttpEffect(application);
    expect(services).toBe(RequestResource);
    expect(external).toBe(External);
    expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<External>();
    const checkAmbientHandler = (): void => {
      // @ts-expect-error An ambient handler retains the external service requirement.
      HttpEffect.toWebHandler(toHttpEffect(application));
    };
    expect(checkAmbientHandler).toBeTypeOf("function");
  });

  it.effect(
    "captures services without building request layers or retaining a closed construction scope",
    () =>
      Effect.gen(function* () {
        const acquisitions: Acquisition[] = [];
        const handler = yield* captureHandler(makeProbeApplication(acquisitions));
        expect(acquisitions).toStrictEqual([]);
        const response = yield* Effect.promise(async () => handler(request("first")));
        expect(acquisitions.map(({ label }) => label)).toStrictEqual(["captured:first"]);
        expect(releaseCounts(acquisitions)).toStrictEqual([0]);
        yield* cancelBody(response);
        expect(releaseCounts(acquisitions)).toStrictEqual([1]);
      }),
  );

  it.effect("lets live external services override captured service references", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const handler = yield* captureHandler(makeProbeApplication(acquisitions));
      const live = Context.make(External, { label: "override" });
      const response = yield* Effect.promise(async () => handler(request("live"), live));
      expect(acquisitions.map(({ label }) => label)).toStrictEqual(["override:live"]);
      yield* cancelBody(response);
    }),
  );
});

const observeConcurrentRequests = (
  acquisitions: Acquisition[],
  first: Promise<Response>,
  second: Promise<Response>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const responses = yield* Effect.promise(async () => Promise.all([first, second]));
    expect(acquisitions.map(({ label }) => label).toSorted()).toStrictEqual(["A:one", "B:two"]);
    expect(new Set(acquisitions.map(({ scope }) => scope)).size).toBe(2);
    expect(releaseCounts(acquisitions)).toStrictEqual([0, 0]);
    yield* Effect.forEach(responses, cancelBody, { discard: true });
    expect(releaseCounts(acquisitions)).toStrictEqual([1, 1]);
  });

describe("request-local services in concurrent ambient requests", () => {
  it.effect("uses current external context and acquires a separate layer for each request", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const http = toHttpEffect(makeProbeApplication(acquisitions));
      const handler = HttpEffect.toWebHandlerWith<never, Effect.Services<typeof http>>(
        Context.empty(),
      )(http);
      const alpha = Context.make(External, { label: "A" });
      const bravo = Context.make(External, { label: "B" });
      const first = handler(request("one"), alpha);
      const second = handler(request("two"), bravo);

      yield* observeConcurrentRequests(acquisitions, first, second);
    }),
  );
});
