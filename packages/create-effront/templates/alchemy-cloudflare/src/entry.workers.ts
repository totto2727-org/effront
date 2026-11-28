import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import type application from "./entry.effront";

export const app = Cloudflare.Worker(
  "App",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01" },
    ...effrontWorkerOptions("app"),
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect<typeof application>();
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);
