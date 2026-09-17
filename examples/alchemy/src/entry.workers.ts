import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { CacheClient } from "./features/greeting/services";
export const Cache = Cloudflare.KV.Namespace("Cache");

export default class App extends Cloudflare.Worker<App>()(
  "App",
  {
    main: import.meta.url,
    dev: { port: 1337 },
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    const cache = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
    // Fixed application loading. Keep this dynamic import unchanged.
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    ).pipe(Effect.provideService(CacheClient, cache));
    return { fetch: fetch.pipe(Effect.orDie) };
  }).pipe(Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding)),
) {}
