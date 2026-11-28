import type { ApplicationDefinition } from "@effront/core";
import { Effect } from "effect";

/** Replaced by the effrontAlchemy plugin only in the RSC compilation graph. */
export const loadConfiguredApplication: Effect.Effect<
  ApplicationDefinition<unknown, unknown, unknown>
> = Effect.die(
  new TypeError(
    "Configured application loading requires the effront plugin followed by the effrontAlchemy plugin.",
  ),
);
