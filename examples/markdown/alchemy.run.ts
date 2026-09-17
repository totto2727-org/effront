import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import Markdown from "./src/entry.workers";
import { stack } from "./stack";

// Direct `vp dev` and `vp preview` run entirely in local workerd. The Alchemy
// CLI's Cloudflare provider profile is required only when invoking that CLI.
export default Stack(
  stack.name,
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Markdown;
    return { url: site.url };
  }),
);
