import { invokeServerFn, resetReactClient } from "./call-server-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array, Deferred, Effect, Fiber, Ref, Stream } from "effect";

import { flightRequests } from "#core/client/flight-client-model.ts";
import { query, stream } from "#core/client/query.ts";
import { ServerFnTransportError } from "#core/rsc/server-fn-error.ts";
import { failQuery, finishQuery, openQuery, waitForRelease } from "./call-server-query.fixture.ts";

const card = "card";
const firstItem = 1;

const cardResponse = (): ReadableStream<string> =>
  new ReadableStream({
    start: (controller) => {
      controller.enqueue(card);
      controller.close();
    },
  });

// oxlint-disable-next-line typescript/promise-function-async -- The streaming query observes the React callback's exact result promise.
const invokeStream = (...args: unknown[]): Promise<ReadableStream<string>> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The fixture's streaming endpoint returns a ReadableStream<string>.
  invokeServerFn("stream", args) as Promise<ReadableStream<string>>;

const pendingStream = Effect.fn("effront.test.collectQueryStream")(function* (stopEarly: boolean) {
  const fixture = yield* openQuery(cardResponse());
  const received = yield* Deferred.make<string>();
  const items = yield* Ref.make<string[]>([]);
  const record = (item: string): Effect.Effect<boolean> =>
    Ref.update(items, Array.append(item)).pipe(Effect.andThen(Deferred.succeed(received, item)));
  const source = stream(invokeStream)("input").pipe(Stream.tap(record));
  const consumer = yield* Stream.runDrain(
    stopEarly ? source.pipe(Stream.take(firstItem)) : source,
  ).pipe(Effect.forkScoped);
  yield* Deferred.await(received);
  const request = yield* Deferred.await(fixture.started);
  return { consumer, fixture, items, query: flightRequests.$is("Query")(request) };
});

const readCard = query(async (...args: unknown[]) => invokeServerFn("value", args));
const pendingValue = Effect.gen(function* () {
  const fixture = yield* openQuery(card);
  const consumer = yield* readCard().pipe(Effect.forkScoped);
  yield* Deferred.await(fixture.started);
  return { consumer, fixture };
});

type Observation = Readonly<{
  consumer: Fiber.Fiber<unknown, unknown>;
  fixture: Effect.Success<ReturnType<typeof openQuery>>;
}>;

const readPending = Effect.fn("effront.test.observeFlightPending")(function* ({
  consumer,
  fixture,
}: Observation) {
  yield* Effect.yieldNow;
  const releases = yield* Ref.get(fixture.releases);
  return { exit: consumer.pollUnsafe(), releases };
});

const uncompleted = { exit: undefined, releases: 0 };

describe("server function streaming Flight ownership", () => {
  beforeEach(resetReactClient);

  it.effect("keeps streaming Flight open after the last item until transport completes", () =>
    Effect.gen(function* () {
      const pending = yield* pendingStream(false);
      expect({ items: yield* Ref.get(pending.items), query: pending.query }).toStrictEqual({
        items: [card],
        query: true,
      });
      expect(yield* readPending(pending)).toStrictEqual(uncompleted);
      yield* finishQuery(pending.fixture);
      yield* Fiber.join(pending.consumer);
      expect(yield* waitForRelease(pending.fixture)).toBe(1);
      expect(yield* Ref.get(pending.items)).toStrictEqual([card]);
    }).pipe(Effect.scoped),
  );

  it.effect("propagates a transport failure after the last streaming item", () =>
    Effect.gen(function* () {
      const pending = yield* pendingStream(false);
      expect({ items: yield* Ref.get(pending.items), query: pending.query }).toStrictEqual({
        items: [card],
        query: true,
      });
      expect(yield* readPending(pending)).toStrictEqual(uncompleted);
      yield* failQuery(pending.fixture, "lost after the last item");
      expect(yield* Effect.flip(Fiber.join(pending.consumer))).toBeInstanceOf(
        ServerFnTransportError,
      );
      expect(yield* waitForRelease(pending.fixture)).toBe(1);
    }).pipe(Effect.scoped),
  );

  it.effect("releases the streaming response once its consumer stops reading", () =>
    Effect.gen(function* () {
      const { consumer, fixture, items, query: queryRequest } = yield* pendingStream(true);
      expect({ items: yield* Ref.get(items), query: queryRequest }).toStrictEqual({
        items: [card],
        query: true,
      });
      yield* Fiber.join(consumer);
      expect(yield* waitForRelease(fixture)).toBe(1);
    }).pipe(Effect.scoped),
  );
});

describe("server function value Flight ownership", () => {
  beforeEach(resetReactClient);

  it.effect("delays a value until its full Flight transport completes", () =>
    Effect.gen(function* () {
      const pending = yield* pendingValue;
      expect(yield* readPending(pending)).toStrictEqual(uncompleted);
      yield* finishQuery(pending.fixture);
      expect(yield* Fiber.join(pending.consumer)).toBe(card);
      expect(yield* waitForRelease(pending.fixture)).toBe(1);
    }).pipe(Effect.scoped),
  );

  it.effect("preserves a late value-query transport failure after the model arrives", () =>
    Effect.gen(function* () {
      const pending = yield* pendingValue;
      expect(yield* readPending(pending)).toStrictEqual(uncompleted);
      yield* failQuery(pending.fixture, "lost after initial model");
      const error = yield* Effect.flip(Fiber.join(pending.consumer));
      expect(error).toBeInstanceOf(ServerFnTransportError);
      expect(error.detail?.message).toContain("lost after initial model");
      expect(yield* waitForRelease(pending.fixture)).toBe(1);
    }).pipe(Effect.scoped),
  );
});
