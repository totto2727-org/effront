import { Effect, Option, Predicate } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/http";

import type { EFFRONTIdentity } from "#core/application/effront-identity.ts";
import { pageParams } from "#core/application/page.ts";
import type { EncodedPageParams, PageParams } from "#core/application/page.ts";
import type { CompiledDestination } from "#core/application/route-graph.ts";
import { isAbsolutePath } from "#core/application/route-path.ts";
import type { AbsolutePath } from "#core/application/route-path.ts";
import { renderRouteTree } from "#core/rsc/render-route-tree.tsx";
import { negotiatePageResponse, pageNotFound, withAcceptVary } from "./application-response.ts";
import type { PageResponse } from "./application-response.ts";
import { FlightRenderer } from "./flight-renderer.tsx";
import { initialPageOutcome } from "./request-outcome.ts";
import type { RequestOutcome } from "./request-outcome.ts";

const emptyEncodedParams: EncodedPageParams = Object.freeze({});

type RenderDestinationOptions<Services> = RequestOutcome &
  Readonly<{
    destination: CompiledDestination<Services>;
    middleware: CompiledDestination<Services>["middleware"];
    request: HttpServerRequest.HttpServerRequest;
  }>;

type RenderLocation = Readonly<{ params: PageParams; pathname: AbsolutePath }>;

const renderPageResponse = Effect.fnUntraced(function* <Services>(
  { renderRuntime }: EFFRONTIdentity<Services>,
  {
    destination,
    formState,
    middleware,
    request,
    serverFnResult,
    status,
    temporaryReferences,
  }: RenderDestinationOptions<Services>,
  { params, pathname }: RenderLocation,
) {
  const routeTree = renderRouteTree({ destination, params, pathname });
  const flightRenderer = yield* FlightRenderer;
  const flight = yield* flightRenderer.render({
    formState,
    middleware,
    renderRuntime,
    routeTree,
    serverFnResult,
    temporaryReferences,
  });
  return yield* negotiatePageResponse(request.headers["accept"], flight, { formState, status });
});

export const renderDestination: <Services>(
  identity: EFFRONTIdentity<Services>,
  options: RenderDestinationOptions<Services>,
) => PageResponse<Services> = Effect.fnUntraced(function* <Services>(
  identity: EFFRONTIdentity<Services>,
  options: RenderDestinationOptions<Services>,
) {
  const { destination, request } = options;
  const requestUrl = HttpServerRequest.toURL(request);
  if (Option.isNone(requestUrl) || !isAbsolutePath(requestUrl.value.pathname)) {
    return yield* Effect.die(
      // oxlint-disable-next-line rules/require-tagged-error -- An invalid router URL retains the native TypeError in the defect.
      new TypeError(`Expected request URL "${request.originalUrl}" to contain an absolute path.`),
    );
  }
  const { pathname } = requestUrl.value;
  const { decodeParams } = destination.page;
  const encoded = yield* Predicate.isNullish(decodeParams)
    ? Effect.succeed(emptyEncodedParams)
    : HttpRouter.params;
  if (request.method !== "POST" && Predicate.isNotNullish(decodeParams)) {
    return yield* decodeParams(encoded).pipe(
      Effect.matchEffect({
        onFailure: () => Effect.succeed(pageNotFound()),
        onSuccess: (value) =>
          renderPageResponse(identity, options, {
            params: pageParams.Decoded({ value }),
            pathname,
          }),
      }),
    );
  }
  return yield* renderPageResponse(identity, options, {
    params: pageParams.Encoded({ value: encoded }),
    pathname,
  });
});

export const renderPageRequest: <Services>(
  identity: EFFRONTIdentity<Services>,
  destination: CompiledDestination<Services>,
  request: HttpServerRequest.HttpServerRequest,
) => PageResponse<Services | HttpServerRequest.HttpServerRequest> = Effect.fnUntraced(function* <
  Services,
>(
  identity: EFFRONTIdentity<Services>,
  destination: CompiledDestination<Services>,
  request: HttpServerRequest.HttpServerRequest,
) {
  return yield* renderDestination(identity, {
    ...initialPageOutcome,
    destination,
    middleware: destination.middleware,
    request,
  });
}, withAcceptVary);
