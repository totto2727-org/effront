import { Context, Effect, Exit, FiberSet, Layer, Scope } from "effect";
import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { AnyMiddleware } from "../application/middleware.ts";
import type { RenderRuntimeContext } from "../application/render-runtime.ts";
import type { FlightPayload, ServerFnResult } from "../rsc/flight.ts";
import type { RouteTreeModel } from "../rsc/route-tree.ts";
import { nextErrorDigest } from "./error-digest.ts";

type FlightStream = ReadableStream<Uint8Array>;

export type FlightRender = Readonly<{
  release: Effect.Effect<void>;
  signal: AbortSignal;
  stream: FlightStream;
}>;

export type FlightRenderOptions<Services> = Readonly<{
  formState: FlightPayload["formState"];
  middleware: Readonly<AnyMiddleware<Services>[]>;
  renderRuntime: RenderRuntimeContext;
  routeTree: RouteTreeModel;
  serverFnResult: ServerFnResult | null;
  temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
}>;

export class FlightRenderer extends Context.Service<FlightRenderer>()(
  "effront/server/flight-renderer/FlightRenderer",
  {
    make: Effect.succeed({
      renderQuery: Effect.fnUntraced(function* <Services>({
        middleware,
        renderRuntime,
        result,
        temporaryReferences,
      }: Readonly<{
        middleware: Readonly<AnyMiddleware<Services>[]>;
        renderRuntime: RenderRuntimeContext;
        result: ServerFnResult;
        temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
      }>): Effect.fn.Return<FlightRender, never, Services | Scope.Scope> {
        const errorDigest = yield* nextErrorDigest;
        const parentScope = yield* Effect.scope;
        const renderScope = yield* Scope.fork(parentScope);
        const release = Scope.close(renderScope, Exit.void);
        return yield* Effect.gen(function* () {
          const runtime = yield* FiberSet.makeRuntimePromise<Services>().pipe(
            Scope.provide(renderScope),
          );
          const signal = yield* Effect.abortSignal.pipe(Scope.provide(renderScope));
          const { renderToReadableStream } = yield* Effect.promise(
            () => import("@vitejs/plugin-rsc/rsc/server"),
          );
          const stream = renderRuntime.bind(runtime, middleware, () =>
            renderToReadableStream(result, {
              onError: (error: unknown) => {
                if (!signal.aborted) {
                  void runtime(
                    Effect.logError(error).pipe(Effect.annotateLogs("errorDigest", errorDigest)),
                  );
                }
                return errorDigest;
              },
              signal,
              temporaryReferences,
            }),
          );
          return { release, signal, stream } satisfies FlightRender;
        }).pipe(Effect.onError(() => release));
      }),
      render: Effect.fnUntraced(function* <Services>({
        formState,
        middleware,
        renderRuntime,
        routeTree,
        serverFnResult,
        temporaryReferences,
      }: FlightRenderOptions<Services>): Effect.fn.Return<
        FlightRender,
        never,
        Services | Scope.Scope
      > {
        const errorDigest = yield* nextErrorDigest;
        const parentScope = yield* Effect.scope;
        const renderScope = yield* Scope.fork(parentScope);
        const release = Scope.close(renderScope, Exit.void);
        return yield* Effect.gen(function* () {
          const runtime = yield* FiberSet.makeRuntimePromise<Services>().pipe(
            Scope.provide(renderScope),
          );
          const signal = yield* Effect.abortSignal.pipe(Scope.provide(renderScope));
          const { renderToReadableStream } = yield* Effect.promise(
            () => import("@vitejs/plugin-rsc/rsc/server"),
          );
          const stream = renderRuntime.bind(runtime, middleware, () => {
            const payload = { formState, routeTree, serverFnResult } satisfies FlightPayload;
            return renderToReadableStream(payload, {
              onError: (error: unknown) => {
                if (!signal.aborted) {
                  void runtime(
                    Effect.logError(error).pipe(Effect.annotateLogs("errorDigest", errorDigest)),
                  );
                }
                return errorDigest;
              },
              signal,
              temporaryReferences,
            });
          });
          return { release, signal, stream } satisfies FlightRender;
        }).pipe(Effect.onError(() => release));
      }),
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
