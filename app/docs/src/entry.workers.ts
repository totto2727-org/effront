import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { docsDeployment, docsHostname, docsStack, productionStage } from "../deployment";

export default class Docs extends Cloudflare.Worker<Docs>()(
  "Docs",
  Effect.gen(function* () {
    const deployment = docsDeployment((yield* Stack).stage);
    const props = {
      main: import.meta.url,
      cache: { enabled: true },
      dev: { port: 1339 },
      compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
      vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
    };
    if (deployment.kind === "production") {
      return { ...props, domain: { name: docsHostname, zoneName: "totto2727.dev" } };
    }
    if (deployment.kind === "preview") {
      const parent = yield* Cloudflare.Worker.ref("Docs", {
        stack: docsStack,
        stage: productionStage,
      });
      return { ...props, preview: { of: parent, name: deployment.name } };
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
