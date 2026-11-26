import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest } from "effect/http";

import { getApplicationState } from "./application/definition.tsx";
import { External } from "./http-external.fixture.ts";
import { makeProbeApplication, releaseCounts } from "./http-probe.fixture.ts";
import type { Acquisition } from "./http-probe.fixture.ts";
import { cancelBody, platformRequest, request } from "./http-request.fixture.ts";
import { makeHttpEffect, toHttpEffect } from "./http.ts";

type Mode = "captured" | "ambient";
type ProbeApplication = ReturnType<typeof makeProbeApplication>;

const resolveHttp = Effect.fnUntraced(function* (mode: Mode, application: ProbeApplication) {
  return mode === "captured" ? yield* makeHttpEffect(application) : toHttpEffect(application);
});

const issueRequests = Effect.fnUntraced(function* (
  mode: Mode,
  application: ProbeApplication,
  memoMap: Layer.MemoMap,
) {
  const httpEffect = yield* resolveHttp(mode, application);
  const build = HttpEffect.toWebHandlerWith<never, Effect.Services<typeof httpEffect>>(
    Context.empty(),
  );
  const handle = build(httpEffect);
  const live = Context.make(External, { label: "host" }).pipe(
    Context.add(Layer.CurrentMemoMap, memoMap),
  );
  const first = yield* Effect.promise(async () => handle(request("one"), live));
  const second = yield* Effect.promise(async () => handle(request("two"), live));
  return [first, second] as const;
});

const exercisePrimedMap = Effect.fnUntraced(function* (
  mode: Mode,
  acquisitions: Acquisition[],
  memoMap: Layer.MemoMap,
) {
  const application = makeProbeApplication(acquisitions);
  const primed = getApplicationState(application).layer.pipe(Layer.provide(HttpRouter.layer));
  yield* Layer.buildWithMemoMap(primed, memoMap, yield* Effect.scope);
  const labelsAtConstruction = acquisitions.map(({ label }) => label);
  const [first, second] = yield* issueRequests(mode, application, memoMap);
  yield* cancelBody(first);
  const releasedAfterFirst = releaseCounts(acquisitions);
  yield* cancelBody(second);
  return {
    labels: acquisitions.map(({ label }) => label),
    labelsAtConstruction,
    releasedAfterFirst,
    releasedAfterSecond: releaseCounts(acquisitions),
    statuses: [first.status, second.status],
  };
});

describe("request acquisition with a primed host memo map", () => {
  it.effect.each(["captured", "ambient"] as const)(
    "isolates two %s requests from prior construction",
    (mode) =>
      Effect.gen(function* () {
        const acquisitions: Acquisition[] = [];
        const memoMap = Layer.makeMemoMapUnsafe();
        const initial = platformRequest("construction");
        const trace = yield* exercisePrimedMap(mode, acquisitions, memoMap).pipe(
          Effect.provideService(External, { label: "host" }),
          Effect.provideService(HttpServerRequest.HttpServerRequest, initial),
          Effect.provideService(Layer.CurrentMemoMap, memoMap),
          Effect.scoped,
        );
        expect(trace).toStrictEqual({
          labels: ["host:construction", "host:one", "host:two"],
          labelsAtConstruction: ["host:construction"],
          releasedAfterFirst: [0, 1, 0],
          releasedAfterSecond: [0, 1, 1],
          statuses: [200, 200],
        });
        expect(releaseCounts(acquisitions)).toStrictEqual([1, 1, 1]);
      }),
  );
});
