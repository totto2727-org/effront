import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

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
    Effect.gen(function* () {
      // Defer application loading until the Worker handles a request.
      const fetch = yield* makeApplicationHttpEffect(() =>
        import("./entry.effront").then((module) => module.default),
      );
      return { fetch: fetch.pipe(Effect.orDie) };
    }),
  );

export default workerLayer();
