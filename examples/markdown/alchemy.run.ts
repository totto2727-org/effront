import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import { markdown } from "./src/entry.workers";

export default Stack(
  "effront-markdown-example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* markdown;
    return { url: site.url };
  }),
);
