import { type ConfiguredApplicationHttpEffect, configureApplication } from "./adapter";
import { loadConfiguredApplication } from "./application-loader";
import { makeApplicationHttpEffect as make } from "./runtime";

/** The configured application is a static dependency only of this RSC entry. */
export const makeApplicationHttpEffect: ConfiguredApplicationHttpEffect = configureApplication(
  make,
  loadConfiguredApplication,
);
