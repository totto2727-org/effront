import { describe, expect, it, test } from "@effect/vitest";
import { Deferred, Effect, Fiber, Stream } from "effect";
import type { Atom } from "effect/reactivity";
import { AsyncResult, AtomRegistry } from "effect/reactivity";
import { vi } from "vitest";

import { ServerFnDefect, ServerFnTransportError } from "#core/rsc/server-fn-error.ts";
import { expectStreamQuery, proxy } from "./query-probe.fixture.ts";
import { stream, streamAtom } from "./query.ts";
import type { MatchedQuery } from "./server-fn-protocol.ts";

const firstArgument = 0;
const singleItem = 1;
// oxlint-disable-next-line unicorn/no-null -- The public Flight transport envelope uses null for missing remote stack traces.
const noStack = null;

const streamValue = (value: string): ReadableStream<string> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(value);
      controller.close();
    },
  });

const fixture = (): Readonly<{
  atom: ReturnType<typeof streamAtom<Readonly<unknown[]>, ReadableStream<string>>>;
  calls: MatchedQuery[];
}> => {
  const calls: MatchedQuery[] = [];
  const atom = streamAtom(
    proxy(
      (matched) => {
        calls.push(matched);
      },
      (args) => streamValue(String(args[firstArgument])),
    ),
  );
  return { atom, calls };
};

const expectAtomValue = async (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<string, unknown>>,
  value: string,
): Promise<void> => {
  await vi.waitFor(() => {
    expect(AsyncResult.getOrThrow(registry.get(atom))).toBe(value);
  });
};

type StreamFixture = ReturnType<typeof fixture>;

const startAtomStream = async (
  registry: AtomRegistry.AtomRegistry,
  { atom, calls }: StreamFixture,
): Promise<void> => {
  registry.mount(atom);
  registry.set(atom, ["first"]);
  await expectAtomValue(registry, atom, "first");
  expect(registry.get(atom).waiting).toBe(true);
  const [first] = calls;
  expect(first?.signal.aborted).toBe(false);
};

const replaceAtomStream = async (
  registry: AtomRegistry.AtomRegistry,
  { atom, calls }: StreamFixture,
): Promise<void> => {
  registry.set(atom, ["second"]);
  await expectAtomValue(registry, atom, "second");
  const [first, second] = calls;
  expect(first?.signal.aborted).toBe(true);
  expect(registry.get(atom).waiting).toBe(true);
  Deferred.doneUnsafe(expectStreamQuery(second).completed, Effect.void);
  await vi.waitFor(() => {
    expect(registry.get(atom).waiting).toBe(false);
  });
  expect(AsyncResult.getOrThrow(registry.get(atom))).toBe("second");
};

describe("stream atom subscription", () => {
  test("keeps streamAtom waiting after the last item and interrupts a superseded Flight", async () => {
    expect.hasAssertions();
    const registry = AtomRegistry.make();
    const sample = fixture();
    try {
      await startAtomStream(registry, sample);
      await replaceAtomStream(registry, sample);
    } finally {
      registry.dispose();
    }
  });
});

const collectCard = Effect.fn("collectCard")(function* () {
  const observed = Promise.withResolvers<MatchedQuery>();
  const read = stream(proxy(observed.resolve, () => streamValue("card")));
  const consumer = yield* Stream.runCollect(read()).pipe(Effect.forkScoped);
  const matched = yield* Effect.promise(async () => observed.promise);
  return { consumer, matched: expectStreamQuery(matched) };
});

it.effect("waits for full Flight completion after the returned stream closes", () =>
  Effect.gen(function* () {
    const { consumer, matched } = yield* collectCard();
    yield* Effect.yieldNow;
    expect(consumer.pollUnsafe()).toBeUndefined();
    expect(matched.signal.aborted).toBe(false);
    yield* Deferred.complete(matched.completed, Effect.void);
    expect(yield* Fiber.join(consumer)).toStrictEqual(["card"]);
    expect(matched.signal.aborted).toBe(true);
  }),
);

it.effect("propagates transport failure after the final stream value", () =>
  Effect.gen(function* () {
    const { consumer, matched } = yield* collectCard();
    yield* Deferred.fail(
      matched.completed,
      new ServerFnTransportError({
        detail: { message: "connection lost", name: "Error", stack: noStack },
      }),
    );
    const failure = yield* Effect.flip(Fiber.join(consumer));
    expect(failure).toBeInstanceOf(ServerFnTransportError);
    expect(failure.detail?.message).toBe("connection lost");
  }),
);

const openStream = (): ReadableStream<string> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue("card");
    },
  });

it.effect("aborts its request when the consumer stops after one item", () =>
  Effect.gen(function* () {
    const observed = Promise.withResolvers<MatchedQuery>();
    const read = stream(proxy(observed.resolve, () => openStream()));
    yield* Stream.runDrain(read().pipe(Stream.take(singleItem)));
    const { signal } = yield* Effect.promise(async () => observed.promise);
    expect(signal.aborted).toBe(true);
  }),
);

const failedStream = (): ReadableStream<string> =>
  new ReadableStream({
    start(controller) {
      const producerError = new DOMException("producer failed", "Error");
      controller.error(Object.assign(producerError, { digest: "render-123" }));
    },
  });

const completeFlight = (matched: MatchedQuery): void => {
  Deferred.doneUnsafe(expectStreamQuery(matched).completed, Effect.void);
};

it.effect("retains a Flight stream error digest", () =>
  Effect.gen(function* () {
    const read = stream(proxy(completeFlight, () => failedStream()));
    const failure = yield* Effect.flip(Stream.runDrain(read()));
    expect(failure).toBeInstanceOf(ServerFnDefect);
    expect(failure).toMatchObject({ digest: "render-123" });
  }),
);
