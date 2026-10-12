import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export default class Docs extends Cloudflare.Worker<Docs>()(
  "Docs",
  Effect.gen(function* () {
    const { stage } = yield* Stack;
    const props = {
      main: import.meta.url,
      cache: { enabled: true },
      dev: { port: 1339 },
      compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
      vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
    };
    if (stage === "production") {
      return { ...props, domain: { name: "effront.totto2727.dev", zoneName: "totto2727.dev" } };
    }
    if (stage.startsWith("preview-")) {
      const parent = yield* Cloudflare.Worker.ref("Docs", { stage: "production" });
      return { ...props, preview: { of: parent } };
    }
    return props;
  }),
  Effect.gen(function* () {
    // Fixed application loading. Keep this dynamic import unchanged.
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    );
    return {
      fetch: fetch.pipe(Effect.orDie),
    };
  }),
) {}
