import { Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { docsStack } from "./deployment";
import Worker from "./src/entry.workers";

export default Stack(
  docsStack,
  { state: Cloudflare.state(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Worker;
    return { url: site.url };
  }),
);
