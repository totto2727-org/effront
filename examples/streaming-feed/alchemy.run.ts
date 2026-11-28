import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { streaming_feed } from "./src/entry.workers";

export default Stack(
  "effront-streaming-feed-example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* streaming_feed;
    return { url: site.url };
  }),
);
