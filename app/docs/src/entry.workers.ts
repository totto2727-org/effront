import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import type application from "./entry.effront.tsx";

export class Docs extends Cloudflare.Worker<Docs, Cloudflare.WorkerShape>()("Docs") {}

export const docsWorker = (
  deployment: Pick<Cloudflare.WorkerProps, "domain" | "preview"> = {},
): ReturnType<typeof Docs.make> =>
  Docs.make(
    {
      cache: { enabled: true },
      compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
      dev: { port: 1339 },
      main: import.meta.url,
      vite: { viteEnvironments: { children: ["ssr"], entry: "rsc" } },
      ...deployment,
    },
    Effect.gen(function* () {
      const fetch = yield* makeApplicationHttpEffect<typeof application>();
      return {
        fetch: fetch.pipe(Effect.orDie),
      };
    }),
  );

// oxlint-disable-next-line import/no-default-export -- Alchemy uses the local worker entrypoint's default resource.
export default docsWorker();
