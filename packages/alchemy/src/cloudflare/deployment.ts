import type { toHttpEffect } from "@effront/core/http";
import { Effect } from "effect";

import { type ApplicationAdapter, makeApplicationAdapter } from "./adapter";

export type { ApplicationLoader } from "./adapter";

const unavailable: typeof toHttpEffect = () =>
  Effect.die(
    new TypeError(
      "Effront Alchemy request handling requires the react-server runtime. Use effront() followed by effrontAlchemy().",
    ),
  );

/** Deployment construction never imports the RSC renderer or application. */
const adapter = makeApplicationAdapter(unavailable);
export const applicationHttpEffect: ApplicationAdapter["applicationHttpEffect"] =
  adapter.applicationHttpEffect;
