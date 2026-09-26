import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import { responseCache } from "./response-cache";

export default Cloudflare.Worker(
  "Docs",
  {
    main: import.meta.url,
    cache: { enabled: true },
    dev: { port: 1339 },
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    // Fixed application loading. Keep this dynamic import unchanged.
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    );
    return {
      // Alchemy evaluates this outer Effect while planning a native deployment.
      // Vite-only environment values are safe only when the Worker handles a request.
      fetch: Effect.suspend(() =>
        fetch.pipe(responseCache({ development: import.meta.env.DEV })),
      ).pipe(Effect.orDie),
    };
  }),
);
