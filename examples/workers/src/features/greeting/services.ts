import { getWorkersEnv } from "@effront/cloudflare/workers";
import { Context, Effect, Layer } from "effect";

export class Host extends Context.Service<
  Host,
  { readonly label: string; readonly greeting: string }
>()("examples/workers/Host") {}

export const HostLive = Layer.effect(
  Host,
  Effect.gen(function* () {
    const env = yield* getWorkersEnv<{ APP_LABEL: string; GREETING: string }>();
    return { label: env.APP_LABEL, greeting: env.GREETING };
  }),
);
