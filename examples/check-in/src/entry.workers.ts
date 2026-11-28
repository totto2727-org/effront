import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { makeCheckInStore } from "./features/check-in/data";
import { CheckInStore } from "./features/check-in/services";

import type application from "./entry.effront";

export const check_in = Cloudflare.Worker(
  "CheckIn",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01" },
    ...effrontWorkerOptions("check_in"),
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
