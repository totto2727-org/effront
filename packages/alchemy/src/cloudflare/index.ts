import type { toHttpEffect } from "@effront/core/http";
import { Effect } from "effect";

import { makeApplicationAdapter } from "./adapter";

export type { ApplicationLoader } from "./adapter";

const unavailable: typeof toHttpEffect = () =>
  Effect.die(
    new TypeError(
      "Effront Alchemy request handling requires the react-server runtime. Use effront() followed by effrontAlchemy().",
    ),
  );

/** Deployment construction never imports the RSC renderer or application. */
export const { applicationHttpEffect, makeApplicationHttpEffect } =
  makeApplicationAdapter(unavailable);
