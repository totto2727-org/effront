import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import Loading from "./src/entry.workers";

export default Stack(
  "effront-loading-example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Loading;
    return { url: site.url };
  }),
);
