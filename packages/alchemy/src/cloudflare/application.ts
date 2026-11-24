import { type ConfiguredApplicationHttpEffect, configureApplication } from "./adapter.ts";
import { loadConfiguredApplication } from "./application-loader.ts";
import { makeApplicationHttpEffect as make } from "./deployment.ts";

/** Deployment-safe construction of the application selected by effront(). */
export const makeApplicationHttpEffect: ConfiguredApplicationHttpEffect = configureApplication(
  make,
  loadConfiguredApplication,
);
