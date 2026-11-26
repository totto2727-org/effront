import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import type application from "./entry.effront";

const Worker = Cloudflare.Worker(
  "Loading",
  {
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    main: import.meta.url,
    vite: { viteEnvironments: { children: ["ssr"], entry: "rsc" } },
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect<typeof application>();
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);

// oxlint-disable-next-line import/no-default-export -- The Alchemy worker loader uses this entry’s default export.
export default Worker;
