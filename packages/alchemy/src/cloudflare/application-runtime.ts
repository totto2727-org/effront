import { configureApplication } from "./adapter.ts";
import type { ConfiguredApplicationHttpEffect } from "./adapter.ts";
import { loadConfiguredApplication } from "./application-loader.ts";
import { makeApplicationHttpEffect as make } from "./runtime.ts";

/** The configured application is a static dependency only of this RSC entry. */
export const makeApplicationHttpEffect: ConfiguredApplicationHttpEffect = configureApplication(
  make,
  loadConfiguredApplication,
);
