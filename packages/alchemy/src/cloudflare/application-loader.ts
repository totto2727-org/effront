import type { ApplicationDefinition } from "@effront/core";

/** Replaced by effrontAlchemy() only in the server runtime compilation graphs. */
export const loadConfiguredApplication = <Services, ApplicationError, Requirements>(): Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
> => {
  throw new TypeError(
    "Configured application loading requires effront() followed by effrontAlchemy().",
  );
};
