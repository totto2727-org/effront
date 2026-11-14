import { type ConfiguredApplicationHttpEffect, configureApplication } from "./adapter";
import { loadConfiguredApplication } from "./application-loader";
import { applicationHttpEffect as handle } from "./deployment";

/** Deployment-safe handler for the application selected by effront(). */
export const applicationHttpEffect: ConfiguredApplicationHttpEffect = configureApplication(
  handle,
  loadConfiguredApplication,
);
