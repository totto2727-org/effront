import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import Worker from "./src/entry.workers";

const stack = Stack(
  "effront-alchemy-example",
  { providers: Cloudflare.providers(), state: localState() },
  Effect.gen(function* () {
    const site = yield* Worker;
    return { url: site.url };
  }),
);

// oxlint-disable-next-line import/no-default-export -- The Alchemy CLI loads the stack from this entry’s default export.
export default stack;
