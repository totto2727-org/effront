import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import type application from "./entry.effront";
import { CacheClient } from "./features/greeting/services.ts";

export const Cache = Cloudflare.KV.Namespace("Cache");

class App extends Cloudflare.Worker<App>()(
  "App",
  {
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    main: import.meta.url,
    vite: { viteEnvironments: { children: ["ssr"], entry: "rsc" } },
  },
  Effect.gen(function* () {
    const cache = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
    const fetch = yield* makeApplicationHttpEffect<typeof application>().pipe(
      Effect.provideService(CacheClient, cache),
    );
    return { fetch: fetch.pipe(Effect.orDie) };
  }).pipe(Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding)),
) {}

// oxlint-disable-next-line import/no-default-export -- The Alchemy worker loader uses this entry’s default export.
export default App;
