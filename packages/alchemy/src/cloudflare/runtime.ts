import { toHttpEffect } from "@effront/core/http";

import { makeApplicationAdapter } from "./adapter";

export type { ApplicationLoader } from "./adapter";

/** Selected only by hosts that compile the react-server execution graph. */
export const { applicationHttpEffect, makeApplicationHttpEffect } =
  makeApplicationAdapter(toHttpEffect);
