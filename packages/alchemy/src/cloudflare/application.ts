import { type ConfiguredApplicationHttpEffect, configureApplication } from "./adapter";
import { loadConfiguredApplication } from "./application-loader";
import { makeApplicationHttpEffect as make } from "./deployment";

/** Deployment-safe construction of the application selected by effront(). */
export const makeApplicationHttpEffect: ConfiguredApplicationHttpEffect = configureApplication(
  make,
  loadConfiguredApplication,
);
