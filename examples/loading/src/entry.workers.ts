import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import type application from "./entry.effront";

export default Cloudflare.Worker(
  "Loading",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    // Load the application only when the Worker handles a request.
    const fetch = yield* makeApplicationHttpEffect<typeof application>();
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);
