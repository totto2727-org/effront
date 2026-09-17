import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import Worker from "./src/entry.workers";
import { stack } from "./stack";

export default Stack(
  stack.name,
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Worker;
    return { url: site.url };
  }),
);
