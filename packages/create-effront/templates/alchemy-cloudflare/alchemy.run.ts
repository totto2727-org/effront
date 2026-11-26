import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import Worker from "./src/entry.workers.ts";

// oxlint-disable-next-line import/no-default-export -- The Alchemy CLI loads the stack's default export.
export default Stack(
  "__PROJECT_NAME__",
  { providers: Cloudflare.providers(), state: localState() },
  Effect.gen(function* () {
    const site = yield* Worker;
    return { url: site.url };
  }),
);
