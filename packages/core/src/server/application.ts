import { Effect, Layer } from "effect";
import type { PlatformError } from "effect";
import type { HttpRouter } from "effect/http";

import { getApplicationState } from "#core/application/definition.tsx";
import type { ApplicationDefinition } from "#core/application/definition.tsx";
import { getEFFRONTIdentity } from "#core/application/effront-identity.ts";
import { registerApplicationRoutes } from "./application-route-layer.ts";
import { FlightRenderer } from "./flight-renderer.tsx";
import type { HtmlRenderError } from "./html-render-error.ts";
import { HtmlRenderer } from "./html-renderer.tsx";
import type { ServerFnRequestFailure } from "./server-fn-request.ts";

const RenderersLayer = Layer.mergeAll(FlightRenderer.layer, HtmlRenderer.layer);

export type RequestServices<Services> = Services | FlightRenderer | HtmlRenderer;
export type HttpApplicationRequirements =
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
  const { layer, routes } = getApplicationState(application);
  const identity = getEFFRONTIdentity(application);
  const RequestLayer = Layer.mergeAll(RenderersLayer, layer);
  return Layer.unwrap(
    Effect.map(Layer.build(RequestLayer), (services) =>
      registerApplicationRoutes(identity, routes, services),
    ),
  );
};

export const ServerApplication = { httpLayer };
