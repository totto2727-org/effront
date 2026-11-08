import { configureApplication } from "./adapter";
import { loadConfiguredApplication } from "./application-loader";
import { makeApplicationHttpEffect as make } from "./index";

/** Deployment-safe construction of the application selected by effront(). */
export const makeApplicationHttpEffect = configureApplication(make, loadConfiguredApplication);
