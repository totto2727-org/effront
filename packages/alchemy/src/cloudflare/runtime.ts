import { toHttpEffect } from "@effront/core/http";

import { makeApplicationAdapter } from "./adapter.ts";
import type { ApplicationAdapter } from "./adapter.ts";

export type { ApplicationLoader } from "./adapter.ts";

/** Selected only by hosts that compile the react-server execution graph. */
const adapter = makeApplicationAdapter(toHttpEffect);
export const applicationHttpEffect: ApplicationAdapter["applicationHttpEffect"] =
  adapter.applicationHttpEffect;
export const makeApplicationHttpEffect: ApplicationAdapter["makeApplicationHttpEffect"] =
  adapter.makeApplicationHttpEffect;
