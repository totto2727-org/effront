import { Deferred, Effect, Function, Layer } from "effect";
import { vi } from "vitest";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { FlightClient } from "#core/client/flight-client.ts";
import { flightRequests } from "#core/client/flight-client-model.ts";
import { makeFlight, recordRefresh } from "./call-server-mutation.fixture.ts";
import { invokeServerFn, transitionTypes } from "./call-server-react.fixture.ts";
import {
  listen,
  navigationFor,
  rendererFor,
  routeLoaderFor,
  withoutNetwork,
} from "./call-server-service.fixture.ts";
import { makeGate, observePromise } from "./client-routing-candidate.fixture.ts";

const holdMutation = Effect.gen(function* () {
  const started = yield* Deferred.make<boolean>();
  const response = yield* Deferred.make<ReturnType<typeof makeFlight>>();
  const signal = Deferred.succeed(started, true);
  return {
    load: signal.pipe(Effect.andThen(Deferred.await(response))),
    send: (resource: ReturnType<typeof makeFlight>): Effect.Effect<boolean> =>
      Deferred.succeed(response, resource),
    started: Deferred.await(started),
  };
});

type PendingMutation = Effect.Success<typeof holdMutation>;

const concurrentTransport = (
  first: PendingMutation,
  second: PendingMutation,
): Layer.Layer<FlightClient> =>
  FlightClient.layerTest({
    load: (request) => {
      if (!flightRequests.$is("ServerFunction")(request)) {
        return Effect.die("Unexpected navigation Flight load.");
      }
      return request.id === "first" ? first.load : second.load;
    },
    loadInitial: Effect.die("Unexpected initial Flight load."),
  });

const recordedRenderer = (): Readonly<{
  rendered: string[];
  renderer: ReturnType<typeof rendererFor>;
}> => {
  const rendered: string[] = [];
  const retired = makeGate();
  const renderer = rendererFor((tree) => {
    rendered.push(tree.id);
    const committed = Promise.resolve();
    return { committed, discard: Function.constant(committed), retired: retired.promise };
  });
  return { rendered, renderer };
};

const openConcurrency = Effect.gen(function* () {
  const first = yield* holdMutation;
  const second = yield* holdMutation;
  const interrupted = vi.fn<() => void>();
  const refresh = yield* recordRefresh(interrupted);
  const direct = makeGate();
  const { rendered, renderer } = recordedRenderer();
  const dependencies = Layer.mergeAll(
    BrowserEffectRunner.layer,
    renderer,
    concurrentTransport(first, second),
    navigationFor(),
    routeLoaderFor(() => direct.open),
    refresh.layer,
  );
  yield* listen(dependencies).pipe(Effect.provide(withoutNetwork));
  return { direct, first, interrupted, refresh, rendered, second };
});

export const startConcurrentMutations = Effect.gen(function* () {
  const fixture = yield* openConcurrency;
  const first = invokeServerFn("first");
  yield* fixture.first.started;
  const second = invokeServerFn("second");
  yield* fixture.second.started;
  return { first, fixture, second };
});

type Running = Effect.Success<typeof startConcurrentMutations>;

export const commitNewer = Effect.fn("effront.test.commitNewerServerFunction")(function* ({
  fixture,
  second,
}: Running) {
  yield* fixture.second.send(makeFlight("newer", "second result", Effect.void));
  const value = yield* observePromise(second);
  yield* fixture.direct.wait;
  return {
    interrupted: fixture.interrupted.mock.calls.length,
    transitions: [...transitionTypes()],
    value,
  };
});

export const finishOlder = Effect.fn("effront.test.finishOlderServerFunction")(function* ({
  first,
  fixture,
}: Running) {
  const released = vi.fn<() => void>();
  const response = makeFlight("older", "first result", Effect.sync(released));
  yield* fixture.first.send(response);
  const value = yield* observePromise(first);
  yield* Deferred.await(fixture.refresh.observed);
  return {
    refresh: fixture.refresh.recorded,
    released: released.mock.calls.length,
    rendered: fixture.rendered,
    value,
  };
});
