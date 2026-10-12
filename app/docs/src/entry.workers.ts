import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export class Docs extends Cloudflare.Worker<Docs, Cloudflare.WorkerShape>()("Docs") {}

export const docsWorker = (deployment: Pick<Cloudflare.WorkerProps, "domain" | "preview"> = {}) =>
  Docs.make(
    {
      main: import.meta.url,
      cache: { enabled: true },
      dev: { port: 1339 },
      compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
      vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
      ...deployment,
    },
    Effect.gen(function* () {
      // Fixed application loading. Keep this dynamic import unchanged.
      const fetch = yield* makeApplicationHttpEffect(() =>
        import("./entry.effront").then((module) => module.default),
      );
      return {
        fetch: fetch.pipe(Effect.orDie),
      };
    }),
  );

export default docsWorker();
