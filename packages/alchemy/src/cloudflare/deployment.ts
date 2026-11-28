import type { toHttpEffect } from "@effront/core/http";
import { Effect } from "effect";

import { type ApplicationAdapter, makeApplicationAdapter } from "./adapter";

export type { ApplicationLoader } from "./adapter";
export { effrontWorkerOptions } from "./worker-options";

const unavailable: typeof toHttpEffect = () =>
  Effect.die(
    new TypeError(
      "Effront Alchemy request handling requires the react-server runtime. Use the effront plugin followed by the effrontAlchemy plugin.",
    ),
  );

/** Deployment construction never imports the RSC renderer or application. */
const adapter = makeApplicationAdapter(unavailable);
export const applicationHttpEffect: ApplicationAdapter["applicationHttpEffect"] =
  adapter.applicationHttpEffect;
export const makeApplicationHttpEffect: ApplicationAdapter["makeApplicationHttpEffect"] =
  adapter.makeApplicationHttpEffect;
