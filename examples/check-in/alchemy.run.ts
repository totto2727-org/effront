import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import CheckIn from "./src/entry.workers";

export default Stack(
  "effront-check-in-example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* CheckIn;
    return { url: site.url };
  }),
);
