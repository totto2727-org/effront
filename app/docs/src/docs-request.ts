import { Context, Effect, Layer, Predicate } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import {
  documentLocale,
  documentPath,
  hasDocumentLocale,
  localizedPath,
} from "./content/locale.ts";

export class RequestPath extends Context.Service<RequestPath, string>()("app/docs/RequestPath") {}

const requestOrigin = "https://effront.local";

export const RequestPathLive = Layer.effect(
  RequestPath,
  Effect.map(
    HttpServerRequest.HttpServerRequest,
    (request) => new URL(request.url, requestOrigin).pathname,
  ),
);

type RedirectTarget = Readonly<{ path: string; fragment?: string }>;

const retiredPaths = new Map<string, RedirectTarget>([
  [
    "/advanced",
    { fragment: "#execution", path: "/advanced/server-function-execution-and-refresh" },
  ],
  ["/advanced/production-startup", { path: "/platforms" }],
  ["/guide/testing", { path: "/best-practices/testing" }],
  ["/platforms/node-bun", { path: "/platforms" }],
]);
const permanentRedirect = 308;

const redirectRetiredArticle = ({
  method,
  url,
}: HttpServerRequest.HttpServerRequest): HttpServerResponse.HttpServerResponse | undefined => {
  if (method !== "GET" && method !== "HEAD") {
    return undefined;
  }
  const request = new URL(url, requestOrigin);
  const target = retiredPaths.get(documentPath(request.pathname));
  if (Predicate.isNullish(target)) {
    return undefined;
  }
  const destination = hasDocumentLocale(request.pathname)
    ? localizedPath(target.path, documentLocale(request.pathname))
    : target.path;
  return HttpServerResponse.redirect(`${destination}${request.search}${target.fragment ?? ""}`, {
    status: permanentRedirect,
  });
};

// Global HTTP middleware handles retired URLs before route matching for HTML and Flight.
export const RetiredArticleRedirects = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const redirect = redirectRetiredArticle(request);
      return Predicate.isNullish(redirect) ? yield* httpEffect : redirect;
    }),
  { global: true },
);
