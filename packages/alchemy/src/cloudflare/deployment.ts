import type { toHttpEffect } from "@effront/core/http";
import { Effect } from "effect";

import { makeApplicationAdapter } from "./adapter.ts";
import type { ApplicationAdapter } from "./adapter.ts";

export type { ApplicationLoader } from "./adapter.ts";

const unavailable: typeof toHttpEffect = () =>
  Effect.die(
    // oxlint-disable-next-line rules/require-tagged-error -- The deployment graph reports a native TypeError when used as a request host.
    new TypeError(
      "Effront Alchemy request handling requires the react-server runtime. Use effront() followed by effrontAlchemy().",
    ),
  );

/** Deployment construction never imports the RSC renderer or application. */
const adapter = makeApplicationAdapter(unavailable);
export const applicationHttpEffect: ApplicationAdapter["applicationHttpEffect"] =
  adapter.applicationHttpEffect;
export const makeApplicationHttpEffect: ApplicationAdapter["makeApplicationHttpEffect"] =
  adapter.makeApplicationHttpEffect;
