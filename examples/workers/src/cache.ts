import type { ReadWriteNamespaceClient } from "alchemy/Cloudflare/KV";
import { Context } from "effect";

/** Capability constructed by Alchemy, consumed only by the request layer. */
export class CacheClient extends Context.Service<CacheClient, ReadWriteNamespaceClient>()(
  "examples/workers/CacheClient",
) {}
