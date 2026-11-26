import { Deferred, Effect, Exit, Predicate } from "effect";
import { setServerCallback } from "@vitejs/plugin-rsc/browser";

import { ServerFnQueryPath } from "#core/rsc/flight.ts";
import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { FlightClient } from "./flight-client.ts";
import { flightRequests, flightResources } from "./flight-client-model.ts";
import { NavigationApi } from "./navigation-api.ts";
import { encodeCall, nativeCallError, settleCall } from "./server-fn-call-result.ts";
import type { ServerFnCall } from "./server-fn-call-result.ts";
import { makeMutationCall } from "./server-fn-mutation.ts";
import { invocationError, matchServerFnQuery, transportError } from "./server-fn-protocol.ts";
import type { MatchedQuery } from "./server-fn-protocol.ts";

const isDocument = flightResources.$is("Document");
const isStream = Predicate.isTagged("Stream");

type QueryFlight = ReturnType<typeof flightResources.Query>;

const finishQuery = Effect.fnUntraced(function* (
  call: ServerFnCall,
  resource: QueryFlight,
  streamed: boolean,
) {
  if (streamed) {
    settleCall(call, resource.payload);
  }
  yield* resource.completed.pipe(
    Effect.mapError((error) => transportError(error.cause)),
    Effect.ensuring(resource.release),
  );
  if (!streamed) {
    settleCall(call, resource.payload);
  }
});

const makeQueryCall = Effect.gen(function* () {
  const flightClient = yield* FlightClient;
  const navigation = yield* NavigationApi;

  return Effect.fnUntraced(function* (call: ServerFnCall, query: MatchedQuery) {
    const encoded = yield* encodeCall(query.args, transportError);
    const request = flightRequests.Query({
      ...encoded,
      destination: new URL(ServerFnQueryPath, navigation.getCurrentUrl()),
      id: call.id,
    });
    const resource = yield* flightClient.loadQuery(request).pipe(Effect.mapError(transportError));
    if (isDocument(resource)) {
      yield* resource.release;
      const error = nativeCallError("A query response cannot request document navigation.");
      return yield* transportError(error);
    }
    return yield* finishQuery(call, resource, isStream(query));
  });
});

export const installCallServer = Effect.gen(function* () {
  const run = yield* BrowserEffectRunner;
  const callMutation = yield* makeMutationCall;
  const callQuery = yield* makeQueryCall;

  yield* Effect.sync(() => {
    // oxlint-disable-next-line typescript/promise-function-async -- React observes the same result promise that the Effect settles.
    setServerCallback((id, args) => {
      const result = Promise.withResolvers<unknown>();
      const call = { args, id, result };
      const query = matchServerFnQuery(args);
      const selected = Predicate.isNullish(query) ? callMutation(call) : callQuery(call, query);
      const operation = selected.pipe(Effect.mapError(invocationError));
      const observed = isStream(query)
        ? operation.pipe(
            Effect.onExit((exit) =>
              Deferred.done(query.completed, Exit.mapError(exit, invocationError)),
            ),
          )
        : operation;
      const signal = query?.signal;
      run(observed, Predicate.isNullish(signal) ? undefined : { signal }).catch(
        (error: unknown) => {
          result.reject(invocationError(error));
        },
      );
      return result.promise;
    });
  });
});
