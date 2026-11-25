import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

const Worker = Cloudflare.Worker(
  "StreamingFeed",
  {
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    main: import.meta.url,
    vite: { viteEnvironments: { children: ["ssr"], entry: "rsc" } },
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect(async () => {
      // oxlint-disable-next-line import/no-relative-parent-imports -- The explicit loader test intentionally imports the real example outside this fixture package.
      const application = await import("../../examples/streaming-feed/src/entry.effront.tsx");
      return application.default;
    });
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);

// oxlint-disable-next-line import/no-default-export -- Alchemy imports the Worker through its default export.
export default Worker;
