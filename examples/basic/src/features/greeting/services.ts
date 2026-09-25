import type { ReadWriteNamespaceClient } from "alchemy/Cloudflare/KV";
import { Context, Effect, Layer } from "effect";

/** Capability constructed by Alchemy, consumed only by the request layer. */
export class CacheClient extends Context.Service<CacheClient, ReadWriteNamespaceClient>()(
  "examples/basic/CacheClient",
) {}

/** Application-facing data has no Cloudflare or Alchemy requirement. */
export class Host extends Context.Service<
  Host,
  {
    readonly label: string;
    readonly greeting: string;
  }
>()("examples/basic/Host") {}

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
