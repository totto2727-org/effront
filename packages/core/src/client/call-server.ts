import { Deferred, Effect, Exit, MutableRef, Schema } from "effect";
import { addTransitionType, startTransition } from "react";
import {
  createTemporaryReferenceSet,
  encodeReply,
  setServerCallback,
} from "@vitejs/plugin-rsc/browser";

import { BrowserEffectRunner } from "./browser-effect-runner";
import { BrowserRenderer } from "./browser-renderer";
import { FlightClient } from "./flight-client";
import { NavigationApi } from "./navigation-api";
import { RouteLoader } from "./route-loader";
import { RouteRefresher } from "./route-refresh";
import { ServerFnQueryPath, type ServerFnResult } from "../rsc/flight";
import { ServerFnDefect, ServerFnInputError } from "../rsc/server-fn-error";
import { invocationError, matchServerFnQuery, transportError } from "./server-fn-protocol";

class ServerFnCallError extends Schema.TaggedError<ServerFnCallError>()("ServerFnCallError", {
  cause: Schema.Defect(),
  message: Schema.String,
}) {}

type ServerFnInvocation =
  | {
      readonly _tag: "HistoryEntry";
      readonly id: string;
      readonly order: number;
      readonly url: string;
    }
  | { readonly _tag: "CurrentUrl"; readonly order: number; readonly url: string };

type ServerFnRefreshSource = "Response" | "CurrentRoute";

export const installCallServer = Effect.gen(function* () {
  const browserRenderer = yield* BrowserRenderer;
  const navigationApi = yield* NavigationApi;
  const run = yield* BrowserEffectRunner;
  const flightClient = yield* FlightClient;
  const routeLoader = yield* RouteLoader;
  const routeRefresher = yield* RouteRefresher;
  const latestInvocationOrder = MutableRef.make(0);
  const settleInvocation = (
    invocationResult: PromiseWithResolvers<unknown>,
    result: ServerFnResult,
  ) => {
    switch (result._tag) {
      case "Success":
        invocationResult.resolve(result.value);
        return;
      case "Failure":
        invocationResult.reject(
          result.error._tag === "ServerFnInputError"
            ? new ServerFnInputError({ detail: result.error.detail })
            : new ServerFnDefect({ detail: result.error.detail, digest: result.error.digest }),
        );
        return;
    }
  };
  const selectRefreshSource = (invocation: ServerFnInvocation): ServerFnRefreshSource => {
    if (
      MutableRef.get(latestInvocationOrder) !== invocation.order ||
      navigationApi.getTransition() !== null
    ) {
      return "CurrentRoute";
    }

    const currentEntry = navigationApi.getCurrentEntry();
    switch (invocation._tag) {
      case "HistoryEntry":
        return currentEntry?.id === invocation.id ? "Response" : "CurrentRoute";
      case "CurrentUrl":
        return currentEntry === null && navigationApi.getCurrentUrl() === invocation.url
          ? "Response"
          : "CurrentRoute";
    }
  };
  const callServer = Effect.fnUntraced(function* (
    id: string,
    args: Array<unknown>,
    invocationResult: PromiseWithResolvers<unknown>,
  ) {
    const currentEntry = navigationApi.getCurrentEntry();
    const order = MutableRef.incrementAndGet(latestInvocationOrder);
    const invocation: ServerFnInvocation =
      currentEntry === null
        ? { _tag: "CurrentUrl", order, url: navigationApi.getCurrentUrl() }
        : {
            _tag: "HistoryEntry",
            id: currentEntry.id,
            order,
            url: currentEntry.url ?? navigationApi.getCurrentUrl(),
          };
    const temporaryReferences = createTemporaryReferenceSet();
    const signal = yield* Effect.abortSignal;
    const body = yield* Effect.tryPromise({
      try: () => encodeReply([...args], { signal, temporaryReferences }),
      catch: (cause) => new ServerFnCallError({ cause, message: "Failed to encode arguments." }),
    });
    const resource = yield* flightClient
      .load({
        _tag: "ServerFunction",
        body,
        destination: new URL(invocation.url),
        id,
        temporaryReferences,
      })
      .pipe(
        Effect.mapError(
          (cause) => new ServerFnCallError({ cause, message: "Server Function request failed." }),
        ),
      );
    if (resource._tag === "Document") {
      yield* resource.release;
      return yield* new ServerFnCallError({
        cause: new Error("A Server Function response cannot request document navigation."),
        message: "Server Function response was incompatible with Flight.",
      });
    }
    const serverFnResult = resource.payload.serverFnResult;
    if (serverFnResult === null) {
      yield* resource.release;
      return yield* new ServerFnCallError({
        cause: new Error("The Flight payload omitted the Server Function return value."),
        message: "Server Function response was incomplete.",
      });
    }
    settleInvocation(invocationResult, serverFnResult);
    // React registered its Action reactions before the request completed. Registering EFFRONT's
    // continuation after settlement lets React close that Action before the refresh Transition.
    yield* Effect.promise(() =>
      invocationResult.promise.then(
        () => undefined,
        () => undefined,
      ),
    );
    let refreshSource = selectRefreshSource(invocation);
    if (refreshSource === "Response") {
      yield* routeRefresher.interruptCurrentRouteRefresh;
      // Interruption awaits cleanup, during which navigation or another invocation can win.
      refreshSource = selectRefreshSource(invocation);
    }

    if (refreshSource === "CurrentRoute") {
      yield* resource.release;
      yield* routeRefresher.refreshCurrentRoute("server-function");
      return;
    }
    const commitRefresh = routeLoader.prepareRefresh(resource.payload.routeTree);
    let published!: ReturnType<BrowserRenderer["Service"]["refresh"]>;
    yield* Effect.sync(() => {
      startTransition(() => {
        addTransitionType("server-function");
        // Do not return the commit Promise from React's Transition Action. React cannot commit the
        // render until that Action ends.
        published = browserRenderer.refresh(resource.payload.routeTree);
      });
    });
    yield* Effect.raceFirst(
      Effect.all([resource.completed, Effect.promise(() => published.committed)], {
        concurrency: "unbounded",
        discard: true,
      }).pipe(Effect.andThen(Effect.sync(commitRefresh))),
      Effect.promise(() => published.retired),
    ).pipe(Effect.ensuring(resource.release), Effect.forkScoped({ startImmediately: true }));
  });

  const callQuery = Effect.fnUntraced(function* (
    id: string,
    args: ReadonlyArray<unknown>,
    invocationResult: PromiseWithResolvers<unknown>,
    kind: "Query" | "Stream",
  ) {
    const temporaryReferences = createTemporaryReferenceSet();
    const signal = yield* Effect.abortSignal;
    const body = yield* Effect.tryPromise({
      try: () => encodeReply([...args], { signal, temporaryReferences }),
      catch: (cause) => transportError(cause),
    });
    const resource = yield* flightClient
      .loadQuery({
        _tag: "Query",
        body,
        destination: new URL(ServerFnQueryPath, navigationApi.getCurrentUrl()),
        id,
        temporaryReferences,
      })
      .pipe(Effect.mapError(transportError));
    if (resource._tag === "Document") {
      yield* resource.release;
      return yield* transportError(
        new Error("A query response cannot request document navigation."),
      );
    }
    if (kind === "Stream") {
      settleInvocation(invocationResult, resource.payload);
    }
    yield* resource.completed.pipe(
      Effect.mapError((error) => transportError(error.cause)),
      Effect.ensuring(resource.release),
    );
    if (kind === "Query") {
      settleInvocation(invocationResult, resource.payload);
    }
  });

  yield* Effect.sync(() => {
    setServerCallback((id, args) => {
      const invocationResult = Promise.withResolvers<unknown>();
      const query = matchServerFnQuery(args);
      let operation =
        query === null
          ? callServer(id, args, invocationResult).pipe(Effect.mapError(invocationError))
          : callQuery(id, query.args, invocationResult, query._tag).pipe(
              Effect.mapError(invocationError),
            );
      if (query?._tag === "Stream") {
        const completed = query.completed;
        operation = operation.pipe(
          Effect.onExit((exit) => Deferred.done(completed, Exit.mapError(exit, invocationError))),
        );
      }
      void run(operation, query === null ? undefined : { signal: query.signal }).catch((cause) =>
        invocationResult.reject(invocationError(cause)),
      );
      return invocationResult.promise;
    });
  });
});
