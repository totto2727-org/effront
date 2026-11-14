import { Effect, Layer, Scope } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { HttpServerError } from "effect/http";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

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
    return response;
  });
