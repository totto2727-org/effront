import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export default Cloudflare.Worker(
  "Docs",
  {
    main: import.meta.url,
    dev: { port: 1339 },
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./application").then((module) => module.default),
    );
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);
