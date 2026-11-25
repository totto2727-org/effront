import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { makeCheckInStore } from "./features/check-in/data.ts";
import { CheckInStore } from "./features/check-in/services.ts";

import type application from "./entry.effront";

const Worker = Cloudflare.Worker(
  "CheckIn",
  {
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    main: import.meta.url,
    vite: { viteEnvironments: { children: ["ssr"], entry: "rsc" } },
  },
  Effect.gen(function* () {
    // One store per Worker instance, supplied to every request through the application host.
    const store = makeCheckInStore();
    const fetch = yield* makeApplicationHttpEffect<typeof application>().pipe(
      Effect.provideService(CheckInStore, store),
    );
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);

// oxlint-disable-next-line import/no-default-export -- Alchemy imports this Worker entry by its default export.
export default Worker;
