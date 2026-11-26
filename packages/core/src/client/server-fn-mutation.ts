import { Data, Effect, Match, MutableRef, Predicate } from "effect";

import { BrowserRenderer } from "./browser-renderer.ts";
import { FlightClient } from "./flight-client.ts";
import { flightRequests, flightResources } from "./flight-client-model.ts";
import { NavigationApi } from "./navigation-api.ts";
import { RouteLoader } from "./route-loader.ts";
import { RouteRefresher } from "./route-refresh.ts";
import { publishRefresh } from "./route-render.ts";
import {
  encodeCall,
  nativeCallError,
  ServerFnCallError,
  settleCall,
} from "./server-fn-call-result.ts";
import type { ServerFnCall } from "./server-fn-call-result.ts";

type RouteFlight = ReturnType<typeof flightResources.Flight>;
type Invocation = Data.TaggedEnum<{
  CurrentUrl: { order: number; url: string };
  HistoryEntry: { id: string; order: number; url: string };
}>;
type RefreshSource = "Response" | "CurrentRoute";

const invocations = Data.taggedEnum<Invocation>();
const isDocument = flightResources.$is("Document");
const firstInvocationOrder = 0;

const captureInvocation = (
  navigation: NavigationApi["Service"],
  latestOrder: MutableRef.MutableRef<number>,
): Invocation => {
  const entry = navigation.getCurrentEntry();
  const order = MutableRef.incrementAndGet(latestOrder);
  return Predicate.isNullish(entry)
    ? invocations.CurrentUrl({ order, url: navigation.getCurrentUrl() })
    : invocations.HistoryEntry({
        id: entry.id,
        order,
        url: entry.url ?? navigation.getCurrentUrl(),
      });
};

const selectRefreshSource = (
  navigation: NavigationApi["Service"],
  latestOrder: number,
  invocation: Invocation,
): RefreshSource => {
  if (latestOrder !== invocation.order || Predicate.isNotNullish(navigation.getTransition())) {
    return "CurrentRoute";
  }
  const current = navigation.getCurrentEntry();
  return Match.value(invocation).pipe(
    Match.tagsExhaustive({
      CurrentUrl: ({ url }): RefreshSource =>
        Predicate.isNullish(current) && navigation.getCurrentUrl() === url
          ? "Response"
          : "CurrentRoute",
      HistoryEntry: ({ id }): RefreshSource => (current?.id === id ? "Response" : "CurrentRoute"),
    }),
  );
};

const responseFailure = (cause: string, message: string): ServerFnCallError =>
  new ServerFnCallError({ cause: nativeCallError(cause), message });

type MutationResource = Effect.Success<ReturnType<FlightClient["Service"]["load"]>>;

const requireMutationResult = Effect.fnUntraced(function* (resource: MutationResource) {
  if (isDocument(resource)) {
    yield* resource.release;
    return yield* responseFailure(
      "A Server Function response cannot request document navigation.",
      "Server Function response was incompatible with Flight.",
    );
  }
  const { serverFnResult } = resource.payload;
  if (Predicate.isNullish(serverFnResult)) {
    yield* resource.release;
    return yield* responseFailure(
      "The Flight payload omitted the Server Function return value.",
      "Server Function response was incomplete.",
    );
  }
  return { resource, serverFnResult };
});

const loadMutation = Effect.fnUntraced(function* (
  flightClient: FlightClient["Service"],
  call: ServerFnCall,
  invocation: Invocation,
) {
  const encoded = yield* encodeCall(
    call.args,
    (cause) => new ServerFnCallError({ cause, message: "Failed to encode arguments." }),
  );
  const request = flightRequests.ServerFunction({
    ...encoded,
    destination: new URL(invocation.url),
    id: call.id,
  });
  const resource = yield* flightClient
    .load(request)
    .pipe(
      Effect.mapError(
        (cause) => new ServerFnCallError({ cause, message: "Server Function request failed." }),
      ),
    );
  return yield* requireMutationResult(resource);
});

const refreshFromResponse = Effect.fnUntraced(function* (
  renderer: BrowserRenderer["Service"],
  routeLoader: RouteLoader["Service"],
  resource: RouteFlight,
) {
  const { routeTree } = resource.payload;
  const commitRefresh = routeLoader.prepareRefresh(routeTree);
  const published = yield* publishRefresh(renderer, routeTree, "server-function");
  const completed = Effect.all(
    [resource.completed, Effect.promise(async () => published.committed)],
    {
      concurrency: "unbounded",
      discard: true,
    },
  );
  const commit = completed.pipe(Effect.andThen(Effect.sync(commitRefresh)));
  yield* Effect.raceFirst(
    commit,
    Effect.promise(async () => published.retired),
  ).pipe(Effect.ensuring(resource.release), Effect.forkScoped({ startImmediately: true }));
});

const waitForReactAction = (call: ServerFnCall): Effect.Effect<void> =>
  Effect.promise(async () => {
    try {
      await call.result.promise;
    } catch {
      // React observes the rejection on the original Server Function result.
    }
  });

export const makeMutationCall = Effect.gen(function* () {
  const renderer = yield* BrowserRenderer;
  const flightClient = yield* FlightClient;
  const navigation = yield* NavigationApi;
  const routeLoader = yield* RouteLoader;
  const refresher = yield* RouteRefresher;
  const latestOrder = MutableRef.make(firstInvocationOrder);

  const refresh = Effect.fnUntraced(function* (invocation: Invocation, resource: RouteFlight) {
    const source = (): RefreshSource =>
      selectRefreshSource(navigation, MutableRef.get(latestOrder), invocation);
    const first = source();
    if (first === "Response") {
      yield* refresher.interruptCurrentRouteRefresh;
    }
    // Interruption awaits cleanup, during which navigation or another invocation can win.
    const selected = first === "Response" ? source() : first;
    if (selected === "CurrentRoute") {
      yield* resource.release;
      yield* refresher.refreshCurrentRoute("server-function");
    } else {
      yield* refreshFromResponse(renderer, routeLoader, resource);
    }
  });

  return Effect.fnUntraced(function* (call: ServerFnCall) {
    const invocation = captureInvocation(navigation, latestOrder);
    const { resource, serverFnResult } = yield* loadMutation(flightClient, call, invocation);
    settleCall(call, serverFnResult);
    // React registered its Action reactions before the request completed.
    yield* waitForReactAction(call);
    return yield* refresh(invocation, resource);
  });
});
