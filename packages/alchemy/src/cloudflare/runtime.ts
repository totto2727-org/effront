import { toHttpEffect } from "@effront/core/http";

import { type ApplicationAdapter, makeApplicationAdapter } from "./adapter";

export type { ApplicationLoader } from "./adapter";

/** Selected only by hosts that compile the react-server execution graph. */
const adapter = makeApplicationAdapter(toHttpEffect);
export const applicationHttpEffect: ApplicationAdapter["applicationHttpEffect"] =
  adapter.applicationHttpEffect;
