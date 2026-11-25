import type { CoreSource } from "./core-source.tsx";

export const coreRuntimeSources = {
  externalContext: {
    code: `  const handler = toHttpEffect(application);
  return Effect.map(Effect.context<CapturedRequirements<Requirements>>(), (context) => {
    const captured: Context.Context<CapturedRequirements<Requirements>> =
      captureExternalContext<HttpRequirements<Requirements>>(context);
    return Effect.contextWith(
      (requestContext: Context.Context<RemainingRequirements<Requirements>>) => {
        const provided: Context.Context<CapturedRequirements<Requirements>> = Context.merge(
          captured,
          requestContext,
        );
        return Effect.provideContext(handler, provided);
      },
    );
  });`,
    language: "typescript",
    path: "packages/core/src/http.ts",
  },
  flightRuntime: {
    code: `  const errorDigest = yield* nextErrorDigest;
  const parentScope = yield* Effect.scope;
  const renderScope = yield* Scope.fork(parentScope);
  const release = Scope.close(renderScope, Exit.void);
  return yield* Effect.gen(function* () {
    const fibers = yield* FiberSet.make().pipe(Scope.provide(renderScope));
    const runtime = yield* FiberSet.runtimePromise(fibers)<Services>();
    const fork = yield* FiberSet.runtime(fibers)<Services>();
    const signal = yield* Effect.abortSignal.pipe(Scope.provide(renderScope));
    const { renderToReadableStream } = yield* Effect.promise(
      async () => import("@vitejs/plugin-rsc/rsc/server"),
    );
    const stream = renderRuntime.bind(runtime, middleware, () =>
      renderToReadableStream(payload, {
        onError: (error: unknown): string => {
          if (!signal.aborted) {
            fork(Effect.logError(error).pipe(Effect.annotateLogs("errorDigest", errorDigest)));
          }
          return errorDigest;
        },
        signal,
        temporaryReferences,
      }),
    );
    return { release, signal, stream } satisfies FlightRender;
  }).pipe(Effect.onError(() => release));`,
    language: "tsx",
    path: "packages/core/src/server/flight-renderer.tsx",
  },
  htmlEof: {
    code: `  const transform = new TransformStream<Uint8Array, Uint8Array>({
    async flush(controller) {
      try {
        htmlWriter.finish(controller);
        // HTML chunks can end inside any token.
        // The SSR tee branch keeps pulling Flight while its browser branch queues.
        await writeFlightStream(flight.reader, { controller, nonce: options?.nonce });
        controller.enqueue(htmlTrailer);
      } catch (error) {
        controller.error(error);
      } finally {
        flight.release();
      }
    },
    transform(chunk, controller) {
      htmlWriter.write(chunk, controller);
    },
  });`,
    language: "typescript",
    path: "packages/core/src/server/flight-html-stream.ts",
  },
  navigationEligibility: {
    code: `const ReactTransitionNavigationInfo = "react-transition";

export const NativeDocumentNavigationInfo = "effront-native-document";

export const isRoutedNavigation = (event: NavigateEvent) =>
  event.canIntercept &&
  !event.hashChange &&
  event.downloadRequest === null &&
  event.formData === null &&
  event.info !== ReactTransitionNavigationInfo &&
  event.info !== NativeDocumentNavigationInfo &&
  event.navigationType !== "reload";`,
    language: "typescript",
    path: "packages/core/src/client/navigation-routing.ts",
  },
  navigationPublication: {
    code: `export const publishNavigation = (
  { navigation, renderer }: PublicationContext,
  { event, linkTransitionTypes }: PublicationRequest,
  resource: RouteResource,
): Effect.Effect<BrowserRendererNavigation> =>
  Effect.sync(() => {
    const current = MutableRef.make(Option.none<BrowserRendererNavigation>());
    startTransition(() => {
      const fromIndex =
        navigation.getTransition()?.from.index ?? navigation.getCurrentEntry()?.index;
      Array.forEach(getNavigationTransitionTypes(event, fromIndex), addTransitionType);
      Array.forEach(linkTransitionTypes, addTransitionType);
      MutableRef.set(current, Option.some(renderer.navigate(resource.routeTree)));
    });
    return Option.getOrThrow(MutableRef.get(current));
  });`,
    language: "typescript",
    path: "packages/core/src/client/navigation-publication.ts",
  },
  requestHandler: {
    code: `export const toHttpEffect = <Services, ApplicationError, Requirements>(
  application: ApplicationDefinition<Services, ApplicationError, Requirements>,
): HttpApplicationEffect<ApplicationError, Requirements> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const length = request.headers["content-length"];
    if (Predicate.isNotNullish(length)) {
      const size = Number(length);
      if (!Number.isSafeInteger(size) || size < minRequestBodySize || size > maxRequestBodySize) {
        return HttpServerResponse.text("Request body exceeds the 10 MiB limit.", { status: 413 });
      }
    }
    // Request layers must not reuse instances from a host's construction memo map.
    const memoMap = yield* Layer.makeMemoMap;
    const handler = yield* HttpRouter.toHttpEffect(ServerApplication.httpLayer(application)).pipe(
      Effect.provideService(Layer.CurrentMemoMap, memoMap),
    );
    const response = yield* handler;`,
    language: "typescript",
    path: "packages/core/src/http.ts",
  },
  responseLifetime: {
    code: `/**
 * Handles the current HTTP request in its host-owned scope.
 *
 * Application layers are built once per evaluation, using the current services.
 * The host must retain the request scope until the body ends, fails, or is cancelled.
 * Effect HTTP's Web handler performs this transfer automatically. Scoping
 * response production alone would close the scope before the body is consumed.
 * @param {ApplicationDefinition<Services, ApplicationError, Requirements>} application The application that owns the request layer.
 * @returns {HttpApplicationEffect<ApplicationError, Requirements>} The handler effect for the current request.
 */`,
    language: "typescript",
    path: "packages/core/src/http.ts",
  },
  serverFnBrand: {
    code: `      const unavailable = Promise.reject<Result>(directInvocationError());
      // oxlint-disable-next-line promise/prefer-await-to-then -- React inspects the original rejected promise; handle it without wrapping or awaiting it.
      unavailable.catch(() => {
        // Direct calls still reject through the original promise.
      });

      return Object.assign(unavailable, {
        [ServerFnInvocationTypeId]: Object.freeze({ effect, identity, middleware }),
      });`,
    language: "typescript",
    path: "packages/core/src/application/server-fn.ts",
  },
  serverFnDecode: {
    code: `    const temporaryReferences = createTemporaryReferenceSet();
    const body = yield* readServerFnBody(request);
    const decoded: unknown = yield* Effect.tryPromise({
      catch: (cause) =>
        requestError("Failed to decode Server Function arguments.", badRequest, cause),
      try: async () =>
        decodeReply(body, {
          arraySizeLimit: ServerFnArraySizeLimit,
          temporaryReferences,
        }),
    });
    const args = yield* decodeArguments(decoded).pipe(
      Effect.mapError((cause) =>
        requestError("Expected a Server Function argument array.", badRequest, cause),
      ),
    );
    const action = yield* Effect.tryPromise({
      catch: (cause) =>
        requestError("The requested Server Function does not exist.", badRequest, cause),
      try: async () => loadServerAction(actionId),
    });`,
    language: "typescript",
    path: "packages/core/src/server/server-fn-request.ts",
  },
  serverFnSchema: {
    code: `    const decode = Schema.decodeUnknownEffect(Schema.Tuple(schemas));`,
    language: "typescript",
    path: "packages/core/src/application/server-fn.ts",
  },
} satisfies Record<string, CoreSource>;
