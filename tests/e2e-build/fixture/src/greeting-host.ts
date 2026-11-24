import { Context, Effect, Layer } from "effect";
import { getWorkersEnv } from "./host.ts";

export class Host extends Context.Service<Host, Readonly<{ greeting: string }>>()(
  "tests/e2e-build/Host",
) {}

export const HostLive = Layer.effect(
  Host,
  Effect.gen(function* () {
    const env = yield* getWorkersEnv();
    return { greeting: env.GREETING };
  }),
);
