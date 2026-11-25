import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import type application from "./entry.effront";

export class Worker extends Cloudflare.Worker<Worker, Cloudflare.WorkerShape>()(
  "effront-alchemy-cloudflare-app",
) {}

const runWorker = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect<typeof application>();
  return { fetch: fetch.pipe(Effect.orDie) };
});

type NativeRequirements = Effect.Services<typeof runWorker>;

export const workerLayer = (
  deployment: Pick<Cloudflare.WorkerProps, "domain" | "preview"> = {},
): ReturnType<typeof Worker.make<never, NativeRequirements>> =>
  Worker.make(
    {
      compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
      main: import.meta.url,
      vite: { viteEnvironments: { children: ["ssr"], entry: "rsc" } },
      ...deployment,
    },
    runWorker,
  );

const local = workerLayer();

// oxlint-disable-next-line import/no-default-export -- The Alchemy worker loader uses this entry’s default export.
export default local;
