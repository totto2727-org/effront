import { Data, Deferred, Effect, Ref } from "effect";

import { FlightClient } from "#core/client/flight-client.ts";
import { flightResources, loadFailure } from "#core/client/flight-client-model.ts";
import type { flightRequests, FlightLoadError } from "#core/client/flight-client-model.ts";
import type { ServerFnResult } from "#core/rsc/flight.ts";
import { listenIdle } from "./call-server-service.fixture.ts";

type QueryRequest = ReturnType<typeof flightRequests.Query>;
type QueryFixture = Effect.Success<ReturnType<typeof openQuery>>;

const result = Data.taggedEnum<ServerFnResult>();
const initialReleaseCount = 0;
const releaseIncrement = 1;

export const openQuery = Effect.fn("effront.test.openServerFunctionQuery")(function* (
  value: unknown,
) {
  const completed = yield* Deferred.make<boolean, FlightLoadError>();
  const released = yield* Deferred.make<boolean>();
  const started = yield* Deferred.make<QueryRequest>();
  const releases = yield* Ref.make(initialReleaseCount);
  const markReleased = Deferred.succeed(released, true);
  const resource = flightResources.Query({
    completed: Deferred.await(completed).pipe(Effect.asVoid),
    payload: result.Success({ value }),
    release: Ref.update(releases, (count) => count + releaseIncrement).pipe(
      Effect.andThen(markReleased),
    ),
  });
  const flight = FlightClient.layerTest({
    loadQuery: (request) => Deferred.succeed(started, request).pipe(Effect.as(resource)),
  });
  yield* listenIdle(flight);
  return { completed, released, releases, started };
});

export const finishQuery = (fixture: QueryFixture): Effect.Effect<boolean> =>
  Deferred.succeed(fixture.completed, true);

export const failQuery = (fixture: QueryFixture, message: string): Effect.Effect<boolean> =>
  Deferred.fail(fixture.completed, loadFailure(message, "RequestFailed"));

export const waitForRelease = (fixture: QueryFixture): Effect.Effect<number> =>
  Deferred.await(fixture.released).pipe(Effect.andThen(Ref.get(fixture.releases)));
