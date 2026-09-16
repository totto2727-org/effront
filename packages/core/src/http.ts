import { Context, Effect, Layer, Scope } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { HttpServerError } from "effect/unstable/http";
import { HttpBody, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import type { ApplicationDefinition } from "./application/definition";
import { ServerApplication } from "./server/application";
import type { HtmlRenderError } from "./server/html-renderer";
import type { ServerFnRequestFailure } from "./server/server-fn-request";

type HttpRequirements<Requirements> =
  | Scope.Scope
  | HttpServerRequest.HttpServerRequest
  | Exclude<HttpRouter.Request.Without<Requirements>, HttpRouter.HttpRouter>
  | HttpRouter.Request.Only<"Requires", Requirements>
  | HttpRouter.Request.Only<"GlobalRequires", Requirements>;

type HttpError<ApplicationError, Requirements> =
  | HttpRouter.Request.Without<ApplicationError | PlatformError>
  | HtmlRenderError
  | ServerFnRequestFailure
  | HttpServerError.HttpServerError
  | HttpRouter.Request.Only<"Error", Requirements>
  | HttpRouter.Request.Only<"GlobalError", Requirements>;

export type HttpApplicationEffect<ApplicationError = never, Requirements = never> = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  HttpError<ApplicationError, Requirements>,
  HttpRequirements<Requirements>
>;

const maxRequestBodySize = 10 * 1024 * 1024;

/**
 * Handles the current HTTP request in its host-owned scope.
 *
 * Application layers are built once per evaluation, using the current services.
 * The host must retain the request scope until the body ends, fails, or is cancelled.
 * Effect HTTP's Web handler performs this transfer automatically. Do not wrap
 * response production alone in Effect.scoped: producing headers does not consume a body.
 */
export const toHttpEffect = <Services, ApplicationError, Requirements>(
  application: ApplicationDefinition<Services, ApplicationError, Requirements>,
): HttpApplicationEffect<ApplicationError, Requirements> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const length = request.headers["content-length"];
    if (length !== undefined) {
      const size = Number(length);
      if (!Number.isSafeInteger(size) || size < 0 || size > maxRequestBodySize) {
        return HttpServerResponse.text("Request body exceeds the 10 MiB limit.", { status: 413 });
      }
    }
    // Request layers must not reuse instances from a host's construction memo map.
    const memoMap = yield* Layer.makeMemoMap;
    const handler = yield* HttpRouter.toHttpEffect(ServerApplication.httpLayer(application)).pipe(
      Effect.provideService(Layer.CurrentMemoMap, memoMap),
    );
    const response = yield* handler;
    // Effect rc.112 transfers every streaming response scope before discarding
    // HEAD bodies. Preserve GET metadata but prevent transfer to an unread body.
    return request.method === "HEAD"
      ? HttpServerResponse.setBody(response, HttpBody.empty).pipe(
          HttpServerResponse.setHeaders(response.headers),
        )
      : response;
  });

type RequestServices = HttpRouter.Provided | HttpRouter.HttpRouter | Layer.CurrentMemoMap;
// Effect.context<R>() includes ambient keys beyond R. Removing keys already
// excluded from the input contract preserves every promised external service.
function captureExternalContext<R>(
  context: Context.Context<Exclude<R, RequestServices>>,
): Context.Context<Exclude<R, RequestServices>>;
function captureExternalContext(context: Context.Context<never>): Context.Context<never> {
  return Context.omit(
    Scope.Scope,
    HttpServerRequest.HttpServerRequest,
    HttpServerRequest.ParsedSearchParams,
    HttpRouter.RouteContext,
    HttpRouter.HttpRouter,
    Layer.CurrentMemoMap,
  )(context);
}
type CapturedRequirements<Requirements> = Exclude<HttpRequirements<Requirements>, RequestServices>;
type RemainingRequirements<Requirements> = Exclude<
  HttpRequirements<Requirements>,
  CapturedRequirements<Requirements>
>;

/**
 * Captures external service references while constructing a reusable HTTP effect.
 *
 * Capturing references does not acquire services or extend their lifetime. Their
 * owner must keep them alive through all response bodies. Application layers are
 * still built per request. Live request services take precedence over captured
 * services, and construction-time HTTP services and scopes are never restored.
 */
export const makeHttpEffect = <Services, ApplicationError, Requirements>(
  application: ApplicationDefinition<Services, ApplicationError, Requirements>,
): Effect.Effect<
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    HttpError<ApplicationError, Requirements>,
    RemainingRequirements<Requirements>
  >,
  never,
  CapturedRequirements<Requirements>
> => {
  const handler = toHttpEffect(application);
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
  });
};
