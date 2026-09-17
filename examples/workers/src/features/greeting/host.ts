import { Context, Effect, Layer } from "effect";
import { CacheClient } from "./cache";

/** Application-facing data has no Cloudflare or Alchemy requirement. */
export class Host extends Context.Service<
  Host,
  {
    readonly label: string;
    readonly greeting: string;
  }
>()("examples/workers/Host") {}

/** KV effects execute inside the live request, not during deployment or isolate startup. */
export const HostLive = Layer.effect(
  Host,
  Effect.gen(function* () {
    const cache = yield* CacheClient;
    yield* cache.put("greeting", "Hello from Alchemy KV");
    const greeting = yield* cache.get("greeting");
    return { label: "Effront + Alchemy", greeting: greeting ?? "" };
  }),
);
