import { assert, describe, it } from "@effect/vitest";
import { Effect, Predicate } from "effect";

import type { FetchHandler } from "#core/workers.ts";
import type { TestEnv } from "./workers-host.fixture.tsx";
import { makeWorker } from "./workers-host.fixture.tsx";

const cleared = 0;
const concurrentRequests = 2;
const releasedRequests = 3;

const request = (
  handler: FetchHandler,
  env: TestEnv,
  requestId = env.value,
): Effect.Effect<Response> =>
  Effect.promise(async () =>
    handler(new Request(`https://workers.test/?request=${env.value}`), env, { requestId }),
  );

const expectPerRequestServices = Effect.fn("expectPerRequestServices")(function* (
  handler: FetchHandler,
  events: string[],
) {
  const [first, second] = yield* Effect.all(
    [request(handler, { value: "first" }, "one"), request(handler, { value: "second" }, "two")],
    { concurrency: "unbounded" },
  );
  assert.strictEqual(
    yield* Effect.promise(async () => first.text()),
    "first|one|https://workers.test/?request=first",
  );
  assert.strictEqual(
    yield* Effect.promise(async () => second.text()),
    "second|two|https://workers.test/?request=second",
  );
  assert.lengthOf(
    events.filter((event) => event === "acquired"),
    concurrentRequests,
  );
  assert.lengthOf(
    events.filter((event) => event === "released"),
    concurrentRequests,
  );
});

const expectEmptyResponseRelease = Effect.fn("expectEmptyResponseRelease")(function* (
  handler: FetchHandler,
  events: string[],
) {
  const empty = yield* request(handler, { mode: "empty", value: "empty" });
  assert.isNull(empty.body);
  assert.deepEqual(events, ["acquired", "released"]);
});

const expectCancellationRelease = Effect.fn("expectCancellationRelease")(function* (
  handler: FetchHandler,
  events: string[],
) {
  const streaming = yield* request(handler, { mode: "stream", value: "stream" });
  const { body } = streaming;
  assert(Predicate.isNotNullish(body));
  yield* Effect.promise(async () => body.cancel());
  assert.deepEqual(events, ["acquired", "released", "acquired", "released"]);
});

const expectFailureRelease = Effect.fn("expectFailureRelease")(function* (
  handler: FetchHandler,
  events: string[],
) {
  const failing = yield* request(handler, { mode: "failure", value: "failure" });
  yield* Effect.flip(Effect.tryPromise(async () => failing.text()));
  assert.lengthOf(
    events.filter((event) => event === "released"),
    releasedRequests,
  );
});

describe("workers response and request lifetime", () => {
  it.effect(
    "builds application services from each request environment and releases at response EOF",
    () =>
      Effect.gen(function* () {
        const events: string[] = [];
        const handler = makeWorker(events);
        yield* expectPerRequestServices(handler, events);
        events.length = cleared;

        yield* expectEmptyResponseRelease(handler, events);
        yield* expectCancellationRelease(handler, events);
        yield* expectFailureRelease(handler, events);
      }),
  );
});
