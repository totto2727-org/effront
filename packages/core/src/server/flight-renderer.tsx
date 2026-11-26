import { Context, Effect, Exit, FiberSet, Layer, Scope } from "effect";
import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { AnyMiddleware } from "#core/application/middleware.ts";
import type { RenderRuntimeContext } from "#core/application/render-runtime.ts";
import type { FlightPayload, ServerFnResult } from "#core/rsc/flight.ts";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { nextErrorDigest } from "./error-digest.ts";

export type FlightRender = Readonly<{
  release: Effect.Effect<void>;
  signal: AbortSignal;
  stream: ReadableStream<Uint8Array>;
}>;

type RenderContext<Services> = Readonly<{
  middleware: Readonly<AnyMiddleware<Services>[]>;
  renderRuntime: RenderRuntimeContext;
  temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
}>;

export type FlightRenderOptions<Services> = RenderContext<Services> &
  Readonly<{
    formState: FlightPayload["formState"];
    routeTree: RouteTreeModel;
    serverFnResult: ServerFnResult | null;
  }>;

type QueryRenderOptions<Services> = RenderContext<Services> & Readonly<{ result: ServerFnResult }>;
type FlightRenderInput<Services> = RenderContext<Services> &
  Readonly<{ payload: FlightPayload | ServerFnResult }>;

const renderFlight = Effect.fnUntraced(function* <Services>({
  middleware,
  payload,
  renderRuntime,
  temporaryReferences,
}: FlightRenderInput<Services>): Effect.fn.Return<FlightRender, never, Services | Scope.Scope> {
  const errorDigest = yield* nextErrorDigest;
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
  }).pipe(Effect.onError(() => release));
});

export class FlightRenderer extends Context.Service<FlightRenderer>()(
  "effront/server/flight-renderer/FlightRenderer",
  {
    make: Effect.succeed({
      render: <Services,>({
        formState,
        routeTree,
        serverFnResult,
        ...context
      }: FlightRenderOptions<Services>): Effect.Effect<
        FlightRender,
        never,
        Services | Scope.Scope
      > => renderFlight({ ...context, payload: { formState, routeTree, serverFnResult } }),
      renderQuery: <Services,>({
        result,
        ...context
      }: QueryRenderOptions<Services>): Effect.Effect<
        FlightRender,
        never,
        Services | Scope.Scope
      > => renderFlight({ ...context, payload: result }),
    }),
  },
) {
  // oxlint-disable-next-line rules/no-readonly -- The service exposes a stable, nonassignable Layer.
  public static readonly layer = Layer.effect(this, this.make);
}
