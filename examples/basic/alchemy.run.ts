import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { app } from "./src/entry.workers";

export default Stack(
  "effront-alchemy-example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* app;
    return { url: site.url };
  }),
);
