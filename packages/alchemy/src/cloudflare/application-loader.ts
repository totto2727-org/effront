import type { ApplicationDefinition } from "@effront/core";

/** Replaced by effrontAlchemy() only in the RSC compilation graph. */
// oxlint-disable-next-line typescript/promise-function-async -- The compile-time stub has the generated loader's signature and throws if invoked before replacement.
export const loadConfiguredApplication = <Services, ApplicationError, Requirements>(): Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
> => {
  // oxlint-disable-next-line rules/require-tagged-error -- The unreplaced loader reports a native TypeError for an invalid host setup.
  throw new TypeError(
    "Configured application loading requires effront() followed by effrontAlchemy().",
  );
};
