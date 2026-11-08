import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import type application from "./entry.effront";

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
      const fetch = yield* makeApplicationHttpEffect<typeof application>();
      return {
        fetch: fetch.pipe(Effect.orDie),
      };
    }),
  );

export default docsWorker();
