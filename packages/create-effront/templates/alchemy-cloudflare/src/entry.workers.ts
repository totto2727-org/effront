import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import type application from "./entry.effront.tsx";

// oxlint-disable-next-line import/no-default-export -- Alchemy treats the worker definition as the default entry.
export default Cloudflare.Worker(
  "App",
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
