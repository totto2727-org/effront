import { applicationPage } from "./core-model-application.tsx";
import { overviewPage } from "./core-model-overview.tsx";
import { routingPage } from "./core-model-routing.tsx";
import type { DocPage } from "./types.ts";

export { coreModelSources } from "./core-model-sources.ts";

export const coreModelPages: Readonly<DocPage[]> = [overviewPage, applicationPage, routingPage];
