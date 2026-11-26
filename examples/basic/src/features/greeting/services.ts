import { Context, Effect, Layer } from "effect";

import { CacheClient } from "./cache-client.ts";

export { CacheClient } from "./cache-client.ts";

/** Application-facing data has no Cloudflare or Alchemy requirement. */
export class Host extends Context.Service<
  Host,
  Readonly<{
    label: string;
    greeting: string;
  }>
>()("examples/basic/Host") {}

/** KV effects execute inside the live request, not during deployment or isolate startup. */
export const HostLive = Layer.effect(
  Host,
  Effect.gen(function* () {
    const cache = yield* CacheClient;
    yield* cache.put("greeting", "Hello from Alchemy KV");
    const greeting = yield* cache.get("greeting");
    return { greeting: greeting ?? "", label: "Effront + Alchemy" };
  }),
);
