import { applicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import type application from "./entry.effront";

export class Worker extends Cloudflare.Worker<Worker, Cloudflare.WorkerShape>()(
  "effront-alchemy-cloudflare-app",
) {}

export const workerLayer = (deployment: Pick<Cloudflare.WorkerProps, "domain" | "preview"> = {}) =>
  Worker.make(
    {
      main: import.meta.url,
      compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
      vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
      ...deployment,
    },
    Effect.succeed({ fetch: applicationHttpEffect<typeof application>().pipe(Effect.orDie) }),
  );

export default workerLayer();
