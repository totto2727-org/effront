import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { makeCheckInStore } from "./features/check-in/data";
import { CheckInStore } from "./features/check-in/services";

export default Cloudflare.Worker(
  "CheckIn",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    // One store per Worker instance, supplied to every request through the application host.
    const store = makeCheckInStore();
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    ).pipe(Effect.provideService(CheckInStore, store));
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);
