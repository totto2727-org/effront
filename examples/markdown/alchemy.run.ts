import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import Markdown from "./src/entry.workers";

export default Stack(
  "effront-markdown-example",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Markdown;
    return { url: site.url };
  }),
);
