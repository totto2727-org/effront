import { Deferred, Effect, Layer, MutableRef } from "effect";
import { vi } from "vitest";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import type { BrowserRenderer } from "#core/client/browser-renderer.ts";
import { FlightClient } from "#core/client/flight-client.ts";

import { makeFlight, recordRefresh } from "./call-server-mutation.fixture.ts";
import { invokeServerFn } from "./call-server-react.fixture.ts";
import {
  firstEntry,
  listen,
  navigationFor,
  rendererFor,
  routeLoaderFor,
  withoutNetwork,
} from "./call-server-service.fixture.ts";

export interface StaleNavigation {
  currentEntry: MutableRef.MutableRef<NavigationHistoryEntry>;
  transition: MutableRef.MutableRef<NavigationTransition | null>;
}

// oxlint-disable-next-line unicorn/no-null -- The native Navigation API returns null while no transition is active.
const idleTransition = null;

const navigationState = (): StaleNavigation => ({
  currentEntry: MutableRef.make(firstEntry),
  transition: MutableRef.make(idleTransition),
});

const unexpectedRender = (): never => {
  // oxlint-disable-next-line rules/require-tagged-error -- A renderer called by a stale response fails the fixture with a native TypeError.
  throw new TypeError("Unexpected response render.");
};

const staleTransport = Effect.gen(function* () {
  const started = yield* Deferred.make<boolean>();
  const pending = yield* Deferred.make<ReturnType<typeof makeFlight>>();
  const acknowledge = Deferred.succeed(started, true);
  const flight = FlightClient.layerTest({
    load: () => acknowledge.pipe(Effect.andThen(Deferred.await(pending))),
    loadInitial: Effect.die("Unexpected initial Flight load."),
  });
  return { flight, pending, started };
});

type ChangeTiming = "BeforeResponse" | "DuringInterruption";
type ChangeNavigation = (navigation: StaleNavigation) => void;
const firstResult = "first result";

const runStaleResponse = Effect.fnUntraced(function* (
  change: ChangeNavigation,
  timing: ChangeTiming,
) {
  const navigation = navigationState();
  const transport = yield* staleTransport;
  const refresh = yield* recordRefresh(() => {
    if (timing === "DuringInterruption") {
      change(navigation);
    }
  });
  const rendered = vi.fn<BrowserRenderer["Service"]["refresh"]>(unexpectedRender);
  const released = vi.fn<() => void>();
  const services = Layer.mergeAll(
    BrowserEffectRunner.layer,
    rendererFor(rendered),
    transport.flight,
    navigationFor(
      () => MutableRef.get(navigation.currentEntry),
      () => MutableRef.get(navigation.transition),
    ),
    routeLoaderFor(),
    refresh.layer,
  );
  yield* listen(services).pipe(Effect.provide(withoutNetwork));

  return { navigation, refresh, released, rendered, transport };
});

export const observeStaleResponse = Effect.fnUntraced(function* (
  change: ChangeNavigation,
  timing: ChangeTiming = "BeforeResponse",
) {
  const ready = yield* runStaleResponse(change, timing);
  const result = invokeServerFn("first");
  yield* Deferred.await(ready.transport.started);
  if (timing === "BeforeResponse") {
    change(ready.navigation);
  }
  const response = makeFlight("stale", firstResult, Effect.sync(ready.released));
  yield* Deferred.succeed(ready.transport.pending, response);
  const value = yield* Effect.promise(async () => result);
  yield* Deferred.await(ready.refresh.observed);
  return {
    recorded: ready.refresh.recorded,
    released: ready.released.mock.calls.length,
    rendered: ready.rendered.mock.calls.length,
    value,
  };
});
