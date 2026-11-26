import { navigationPage } from "./core-runtime-navigation.tsx";
import { renderingPage } from "./core-runtime-rendering.tsx";
import { requestPage } from "./core-runtime-request.tsx";
import { serverFunctionsPage } from "./core-runtime-server-functions.tsx";
import type { DocPage } from "./types.ts";

export { coreRuntimeSources } from "./core-runtime-sources.ts";

export const coreRuntimePages: Readonly<DocPage[]> = [
  requestPage,
  renderingPage,
  navigationPage,
  serverFunctionsPage,
];
