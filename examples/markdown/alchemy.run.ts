import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { stack } from "./stack";

export const Website = Cloudflare.Website.Vite("Markdown", {
  main: "./src/entry.workers.ts",
  dev: { port: 1338 },
  compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
  viteEnvironments: { entry: "rsc", children: ["ssr"] },
});

export default Stack(
  stack.name,
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Website;
    return { url: site.url };
  }),
);
