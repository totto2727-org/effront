import type { ApplicationDefinition, ApplicationServices } from "@effront/core";
import type { HttpApplicationEffect, toHttpEffect as CoreHttpEffect } from "@effront/core/http";
import { Effect } from "effect";

import type { loadConfiguredApplication } from "./application-loader";

/** Resolves an application for the current Worker request. */
export type ApplicationLoader<Services, ApplicationError, Requirements> = () => Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
>;

/** Keeps declaration emission on named public contracts. */
export interface ApplicationAdapter {
  readonly applicationHttpEffect: <Services, ApplicationError, Requirements>(
    load: ApplicationLoader<Services, ApplicationError, Requirements>,
  ) => HttpApplicationEffect<ApplicationError, Requirements>;
}

export interface ConfiguredApplicationHttpEffect {
  <
    Definition extends ApplicationDefinition<ApplicationServices<Definition>, unknown, unknown>,
  >(): Definition extends ApplicationDefinition<
    infer _Services,
    infer ApplicationError,
    infer Requirements
  >
    ? HttpApplicationEffect<ApplicationError, Requirements>
    : never;
}

export const makeApplicationAdapter = (
  toHttpEffect: typeof CoreHttpEffect,
): ApplicationAdapter => ({
  /** The host supplies request services. Application capabilities use normal Effect provision. */
  applicationHttpEffect: (load) =>
    Effect.gen(function* () {
      const application = yield* Effect.promise(load);
      return yield* toHttpEffect(application);
    }),
});

/** Binds the configured entry without importing it into explicit-loader hosts. */
export const configureApplication = (
  handle: ApplicationAdapter["applicationHttpEffect"],
  load: typeof loadConfiguredApplication,
): ConfiguredApplicationHttpEffect => {
  function applicationHttpEffect<
    Definition extends ApplicationDefinition<ApplicationServices<Definition>, unknown, unknown>,
  >(): Definition extends ApplicationDefinition<
    infer _Services,
    infer ApplicationError,
    infer Requirements
  >
    ? HttpApplicationEffect<ApplicationError, Requirements>
    : never;
  function applicationHttpEffect() {
    return handle(load);
  }
  return applicationHttpEffect;
};
