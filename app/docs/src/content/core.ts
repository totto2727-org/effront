import { coreModelPages, coreModelSources } from "./core-model.tsx";
import { coreRuntimePages, coreRuntimeSources } from "./core-runtime.tsx";

export const corePages = [...coreModelPages, ...coreRuntimePages];
export const coreSources = [
  ...Object.values(coreModelSources),
  ...Object.values(coreRuntimeSources),
];
