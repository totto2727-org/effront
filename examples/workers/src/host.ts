import { getWorkersEnv } from "@effront/core/workers";
import type { InferEnv } from "alchemy/Cloudflare";
import { Context, Effect, Layer } from "effect";
import type { Website } from "../alchemy.run";

/** Application-facing data has no Cloudflare or Alchemy requirement. */
export class Host extends Context.Service<
  Host,
  {
    readonly label: string;
    readonly greeting: string;
  }
>()("examples/workers/Host") {}

/** KV effects execute inside the live request, never during infrastructure evaluation. */
export const HostLive = Layer.effect(
  Host,
  Effect.gen(function* () {
    const { Cache } = yield* getWorkersEnv<InferEnv<typeof Website>>();
    yield* Effect.tryPromise(() => Cache.put("greeting", "Hello from Alchemy KV"));
    const greeting = yield* Effect.tryPromise<string | null>(() => Cache.get("greeting", "text"));
    return { label: "Effront + Alchemy", greeting: greeting ?? "" };
  }),
);
