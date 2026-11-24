import { Predicate, Array, Context, Effect, Layer, Option, Stream, String } from "effect";
import type { PlatformError, Types } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { getApplicationState } from "#core/application/definition.tsx";
import type { ApplicationDefinition } from "#core/application/definition.tsx";
import { getEFFRONTIdentity } from "#core/application/effront-identity.ts";
import { applyMiddleware, getScopedHttpMiddleware } from "#core/application/middleware.ts";
import type { AnyMiddleware } from "#core/application/middleware.ts";
import type { EncodedPageParams, PageParams } from "#core/application/page.ts";
import type { CompiledDestination } from "#core/application/route-graph.ts";
import { analyzeRoutePath, isAbsolutePath } from "#core/application/route-path.ts";
import { FlightMediaType, ServerFnQueryPath } from "#core/rsc/flight.ts";
import { renderRouteTree } from "#core/rsc/render-route-tree.tsx";
import { FlightRenderer } from "./flight-renderer.tsx";
import type { HtmlRenderError } from "./html-renderer.tsx";
import { HtmlRenderer } from "./html-renderer.tsx";
import type { RequestOutcome } from "./request-outcome.ts";
import { prepareServerFnQuery } from "./server-fn-query.ts";
import { prepareServerFnRequest } from "./server-fn-request.ts";
import type { PreparedServerFnRequest, ServerFnRequestFailure } from "./server-fn-request.ts";

const RenderersLayer = Layer.mergeAll(FlightRenderer.layer, HtmlRenderer.layer);

const EmptyEncodedPageParams: EncodedPageParams = Object.freeze({});
const DynamicResponseHeaders = {
  "cache-control": "private, no-store",
} as const;

const appendAcceptVary = (vary: string | undefined): string => {
  if (Predicate.isNullish(vary) || String.isEmpty(vary.trim())) {
    return "Accept";
  }

  const fields = new Set(vary.split(",").map((field) => field.trim().toLowerCase()));
  return fields.has("*") || fields.has("accept") ? vary : `${vary}, Accept`;
};

const acceptVaryPreResponseHandler: HttpEffect.PreResponseHandler = (_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeader(response, "vary", appendAcceptVary(response.headers["vary"])),
  );

type RenderOptions<Services> = RequestOutcome &
  Readonly<{
    destination: CompiledDestination<Services>;
    middleware: Readonly<AnyMiddleware<Services>[]>;
    request: HttpServerRequest.HttpServerRequest;
  }>;

const fromWebStream = (
  stream: ReadableStream<Uint8Array>,
  options?: Readonly<{ releaseLockOnEnd?: boolean }>,
) =>
  Stream.fromReadableStream({
    evaluate: () => stream,
    onError: (cause) => cause,
    releaseLockOnEnd: options?.releaseLockOnEnd,
  });

const combinePageMiddleware = <Services>(
  middleware: Readonly<AnyMiddleware<Services>[]>,
  last: AnyMiddleware<Services>,
) =>
  middleware
    .slice(0, -1)
    .reduceRight(
      (combined, current) => combined.combine(getScopedHttpMiddleware(current)),
      getScopedHttpMiddleware(last),
    );

type HttpApplicationRequirements =
  | HttpRouter.HttpRouter
  | HttpRouter.Request.From<"Error", HtmlRenderError | ServerFnRequestFailure>;

export type HttpApplicationLayer<ApplicationError, Requirements = never> = Layer.Layer<
  never,
  ApplicationError | PlatformError.PlatformError,
  HttpApplicationRequirements | Requirements
>;

const httpLayer = <Services, ApplicationError, Requirements>(
  application: ApplicationDefinition<Services, ApplicationError, Requirements>,
): HttpApplicationLayer<ApplicationError, Requirements> => {
  const applicationState = getApplicationState(application);
  const identity = getEFFRONTIdentity(application);
  const render = Effect.fnUntraced(function* ({
    destination,
    formState,
    middleware,
    request,
    serverFnResult,
    status,
    temporaryReferences,
  }: RenderOptions<Services>) {
    const requestUrl = HttpServerRequest.toURL(request);
    if (Option.isNone(requestUrl) || !isAbsolutePath(requestUrl.value.pathname)) {
      return yield* Effect.die(
        new TypeError(`Expected request URL "${request.originalUrl}" to contain an absolute path.`),
      );
    }

    const { pathname } = requestUrl.value;
    const { decodeParams } = destination.page;
    const encodedParams = yield* Predicate.isNullish(decodeParams)
      ? Effect.succeed(EmptyEncodedPageParams)
      : HttpRouter.params;
    const renderResponse = Effect.fnUntraced(function* (params: PageParams) {
      const routeTree = renderRouteTree({
        destination,
        params,
        pathname,
      });
      const flightRenderer = yield* FlightRenderer;
      const flight = yield* flightRenderer.render({
        formState,
        middleware,
        renderRuntime: identity.renderRuntime,
        routeTree,
        serverFnResult,
        temporaryReferences,
      });

      if (request.headers["accept"] === FlightMediaType) {
        return HttpServerResponse.stream(
          fromWebStream(flight.stream, { releaseLockOnEnd: true }).pipe(
            Stream.ensuring(flight.release),
          ),
          {
            contentType: `${FlightMediaType};charset=utf-8`,
            headers: {
              ...DynamicResponseHeaders,
            },
            status,
          },
        );
      }

      const htmlRenderer = yield* HtmlRenderer;
      const htmlStream = yield* htmlRenderer
        .render({ flight, formState })
        .pipe(Effect.onError(() => flight.release));

      return HttpServerResponse.stream(
        fromWebStream(htmlStream).pipe(Stream.ensuring(flight.release)),
        {
          contentType: "text/html;charset=utf-8",
          headers: DynamicResponseHeaders,
          status,
        },
      );
    });

    if (request.method !== "POST" && Predicate.isNotNullish(decodeParams)) {
      return yield* decodeParams(encodedParams).pipe(
        Effect.matchEffect({
          onFailure: () =>
            Effect.succeed(
              HttpServerResponse.empty({ status: 404, headers: DynamicResponseHeaders }),
            ),
          onSuccess: (value) => renderResponse({ _tag: "Decoded", value }),
        }),
      );
    }
    return yield* renderResponse({ _tag: "Encoded", value: encodedParams });
  });

  const executeServerFnAndRefresh = (
    prepared: PreparedServerFnRequest<Services>,
    destination: CompiledDestination<Services>,
    request: HttpServerRequest.HttpServerRequest,
  ) => {
    const refreshMiddleware = destination.middleware.filter(
      (middleware) => !prepared.middleware.includes(middleware),
    );
    const renderMiddleware = Array.isReadonlyArrayEmpty(refreshMiddleware)
      ? prepared.middleware
      : Object.freeze([...prepared.middleware, ...refreshMiddleware]);
    const response = prepared.execute.pipe(
      Effect.flatMap((outcome) => {
        const refresh = render({
          ...outcome,
          destination,
          middleware: renderMiddleware,
          request,
        });
        return applyMiddleware(refreshMiddleware, refresh);
      }),
    );

    return applyMiddleware(prepared.middleware, response);
  };

  const RequestLayer = Layer.mergeAll(RenderersLayer, applicationState.layer);
  const ApplicationRoutesLayer = Layer.unwrap(
    Effect.map(Layer.build(RequestLayer), (applicationServices) => {
      const RequestContextMiddleware = HttpRouter.middleware<{
        provides: Services | FlightRenderer | HtmlRenderer;
      }>()((httpEffect): Effect.Effect<HttpServerResponse.HttpServerResponse, Types.unhandled> =>
        Effect.flatMap(Effect.context(), (requestContext) =>
          httpEffect.pipe(
            Effect.provideContext(Context.merge(requestContext, applicationServices)),
          ),
        ),
      );
      const QueryLayer = HttpRouter.add("POST", ServerFnQueryPath, (request) =>
        prepareServerFnQuery(request, identity).pipe(
          Effect.flatMap((prepared) =>
            applyMiddleware(
              prepared.middleware,
              Effect.gen(function* () {
                const result = yield* prepared.execute;
                const renderer = yield* FlightRenderer;
                const flight = yield* renderer.renderQuery({
                  result,
                  middleware: prepared.middleware,
                  renderRuntime: identity.renderRuntime,
                  temporaryReferences: prepared.temporaryReferences,
                });
                return HttpServerResponse.stream(
                  fromWebStream(flight.stream, { releaseLockOnEnd: true }).pipe(
                    Stream.ensuring(flight.release),
                  ),
                  {
                    contentType: `${FlightMediaType};charset=utf-8`,
                    headers: DynamicResponseHeaders,
                    status: 200,
                  },
                );
              }),
            ),
          ),
          Effect.catchTag("ServerFnRequestError", (error) =>
            Effect.succeed(
              HttpServerResponse.text(error.message, {
                headers: DynamicResponseHeaders,
                status: error.status,
              }),
            ),
          ),
          HttpEffect.withPreResponseHandler(acceptVaryPreResponseHandler),
        ),
      ).pipe(Layer.provide(RequestContextMiddleware.layer));
      const makeRouteLayer = (destination: CompiledDestination<Services>) => {
        const { catchAll, matcher } = analyzeRoutePath(destination.pattern);
        const RouteParamsMiddleware = HttpRouter.middleware()((httpEffect) =>
          Effect.gen(function* () {
            if (Predicate.isNullish(catchAll)) {
              return yield* httpEffect;
            }
            const context = yield* HttpRouter.RouteContext;
            const { "*": captured, ...parameters } = context.params;
            // Matching and decoding belong to Effect HTTP. Only adapt its wildcard key.
            return yield* Effect.provideService(httpEffect, HttpRouter.RouteContext, {
              route: context.route,
              params: Object.freeze({ ...parameters, [catchAll]: captured ?? "" }),
            });
          }),
        );
        const GetLayer = HttpRouter.add("GET", matcher, (request) =>
          render({
            destination,
            formState: null,
            middleware: destination.middleware,
            request,
            serverFnResult: null,
            status: 200,
          }).pipe(HttpEffect.withPreResponseHandler(acceptVaryPreResponseHandler)),
        );
        const lastPageMiddleware = destination.middleware.at(-1);
        const PageMiddleware = Predicate.isNullish(lastPageMiddleware)
          ? RequestContextMiddleware
          : combinePageMiddleware(destination.middleware, lastPageMiddleware).combine(
              RequestContextMiddleware,
            );
        const PageLayer = GetLayer.pipe(
          Layer.provide(PageMiddleware.combine(RouteParamsMiddleware).layer),
        );
        const ServerFnLayer = HttpRouter.add("POST", matcher, (request) =>
          prepareServerFnRequest(request, identity).pipe(
            Effect.flatMap((prepared) => executeServerFnAndRefresh(prepared, destination, request)),
            Effect.catchTag("ServerFnRequestError", (error) =>
              Effect.succeed(
                HttpServerResponse.text(error.message, {
                  headers: DynamicResponseHeaders,
                  status: error.status,
                }),
              ),
            ),
            HttpEffect.withPreResponseHandler(acceptVaryPreResponseHandler),
          ),
        ).pipe(Layer.provide(RequestContextMiddleware.combine(RouteParamsMiddleware).layer));

        return Layer.mergeAll(PageLayer, ServerFnLayer);
      };
      const [firstDestination, ...remainingDestinations] = applicationState.routes;
      return Layer.mergeAll(
        QueryLayer,
        makeRouteLayer(firstDestination),
        ...remainingDestinations.map(makeRouteLayer),
      );
    }),
  );

  return ApplicationRoutesLayer;
};

export const ServerApplication = { httpLayer };
