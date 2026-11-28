import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { check_in } from "./src/entry.workers";

export default Stack(
  "effront-check-in-example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* check_in;
    return { url: site.url };
  }),
);
