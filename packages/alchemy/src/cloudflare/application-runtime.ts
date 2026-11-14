import { type ConfiguredApplicationHttpEffect, configureApplication } from "./adapter";
import { loadConfiguredApplication } from "./application-loader";
import { applicationHttpEffect as handle } from "./runtime";

/** The configured application is a static dependency only of this RSC entry. */
export const applicationHttpEffect: ConfiguredApplicationHttpEffect = configureApplication(
  handle,
  loadConfiguredApplication,
);
