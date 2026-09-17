import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { CacheClient } from "./features/greeting/cache";

// Customize: declare the resources your application needs.
export const Cache = Cloudflare.KV.Namespace("Cache");

/**
 * Customize the resource ID, development port, and application capabilities below.
 * Changing the resource ID changes infrastructure identity, not just its display name.
 * Keep main, the RSC/SSR environment topology, and the deferred application import
 * aligned with effrontAlchemy. Routes, UI, and request-scoped layers belong in entry.effront.tsx.
 */
export default class App extends Cloudflare.Worker<App>()(
  "App",
  {
    // Integration: this module is the native Worker entry; do not point it at the RSC app.
    main: import.meta.url,
    // Customize: local listening port.
    dev: { port: 1337 },
    // Keep nodejs_compat; update the date only to one supported by the target runtime.
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    // Integration: keep the RSC entry and SSR child together.
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    // Customize: bind resources and provide matching application services here.
    // Run KV I/O in the request layer, not during construction.
    const cache = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
    // Integration: keep this import deferred so CLI construction never loads RSC/CSS.
    // Customize the exported definition in entry.effront.tsx, not this loading mechanism.
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    ).pipe(Effect.provideService(CacheClient, cache));
    // Customize error handling if needed, but keep fetch as a native HTTP Effect.
    return { fetch: fetch.pipe(Effect.orDie) };
  }).pipe(
    // Keep this provider while using ReadWriteNamespace; change it with the capabilities above.
    Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding),
  ),
) {}
