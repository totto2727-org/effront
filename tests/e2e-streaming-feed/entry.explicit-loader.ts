import { applicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export default Cloudflare.Worker(
  "StreamingFeed",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.succeed({
    fetch: applicationHttpEffect(() =>
      import("../../examples/streaming-feed/src/entry.effront").then((module) => module.default),
    ).pipe(Effect.orDie),
  }),
);
