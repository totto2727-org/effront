import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import CheckIn from "./src/entry.workers";

const stack = Stack(
  "effront-check-in-example",
  { providers: Cloudflare.providers(), state: localState() },
  Effect.gen(function* () {
    const site = yield* CheckIn;
    return { url: site.url };
  }),
);

// oxlint-disable-next-line import/no-default-export -- The Alchemy CLI loads the default stack from this entry.
export default stack;
