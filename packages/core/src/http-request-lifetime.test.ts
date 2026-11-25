import { describe, expect, it } from "@effect/vitest";
import { Effect, MutableRef } from "effect";
import { HttpEffect } from "effect/http";

import { External } from "./http-external.fixture.ts";
import { captureHandler, makeProbeApplication, releaseCounts } from "./http-probe.fixture.ts";
import type { Acquisition } from "./http-probe.fixture.ts";
import { cancelBody, request } from "./http-request.fixture.ts";
import { makeHttpEffect } from "./http.ts";

const bytesPerMiB = 1024 * 1024;
const maxRequestBodyBytes = 10 * bytesPerMiB;

const beginAbortableRequest = Effect.fn("effront.test.beginAbortableRequest")(function* (
  acquisitions: Acquisition[],
) {
  const interrupted = MutableRef.make(false);
  const pending = Effect.never.pipe(
    Effect.onInterrupt(() => Effect.sync(() => MutableRef.set(interrupted, true))),
  );
  const handle = yield* captureHandler(makeProbeApplication(acquisitions, () => pending));
  const controller = new AbortController();
  const response = handle(request("abort", { signal: controller.signal }));
  return { controller, interrupted, response };
});

describe("http request scope before starting the body", () => {
  it.effect("rejects oversized requests before acquiring application services", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const handle = yield* captureHandler(makeProbeApplication(acquisitions));
      const oversized = request("oversize", {
        headers: { "content-length": String(maxRequestBodyBytes + 1) },
      });
      const response = yield* Effect.promise(async () => handle(oversized));
      expect(response.status).toBe(413);
      expect(acquisitions).toStrictEqual([]);
    }),
  );

  it.effect("interrupts pending work and releases application resources on client abort", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const { controller, interrupted, response } = yield* beginAbortableRequest(acquisitions);
      yield* Effect.promise(async () => {
        await expect.poll(() => acquisitions.length).toBe(1);
      });
      controller.abort();
      yield* Effect.promise(async () => response);
      yield* Effect.promise(async () => {
        await expect.poll(() => releaseCounts(acquisitions)).toStrictEqual([1]);
      });
      expect(MutableRef.get(interrupted)).toBe(true);
    }),
  );
});

const releaseRequest = Effect.fn("effront.test.finishExternalHttpRequest")(function* (
  hostReleases: MutableRef.MutableRef<number>,
  acquisitions: Acquisition[],
) {
  const external = yield* Effect.acquireRelease(Effect.succeed({ label: "host" }), () =>
    Effect.sync(() => MutableRef.increment(hostReleases)),
  );
  const http = yield* makeHttpEffect(makeProbeApplication(acquisitions)).pipe(
    Effect.provideService(External, external),
  );
  const handle = HttpEffect.toWebHandler(http);
  const response = yield* Effect.promise(async () => handle(request("owned")));
  yield* cancelBody(response);
  return MutableRef.get(hostReleases);
});

describe("request scope and host service ownership", () => {
  it.effect("keeps host-owned services until their own scope closes", () =>
    Effect.gen(function* () {
      const hostReleases = MutableRef.make(0);
      const acquisitions: Acquisition[] = [];
      const releasedAfterRequest = yield* releaseRequest(hostReleases, acquisitions).pipe(
        Effect.scoped,
      );
      expect({
        afterHost: MutableRef.get(hostReleases),
        afterRequest: releasedAfterRequest,
        requestLayer: releaseCounts(acquisitions),
      }).toStrictEqual({ afterHost: 1, afterRequest: 0, requestLayer: [1] });
    }),
  );
});
