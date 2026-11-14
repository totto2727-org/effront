import type { ApplicationDefinition } from "@effront/core";
import { Effect } from "effect";

/** Replaced by effrontAlchemy() only in the RSC compilation graph. */
export const loadConfiguredApplication: Effect.Effect<
  ApplicationDefinition<unknown, unknown, unknown>
> = Effect.die(
  new TypeError("Configured application loading requires effront() followed by effrontAlchemy()."),
);
