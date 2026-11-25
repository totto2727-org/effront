import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import local, { Worker, workerLayer } from "./src/entry.workers";

const preview = Cloudflare.Worker.ref("effront-alchemy-cloudflare-app", {
  stage: "production",
}).pipe(Effect.map((parent) => workerLayer({ preview: { of: parent } })));

const stack = Stack(
  "effront-alchemy-cloudflare",
  { providers: Cloudflare.providers(), state: localState() },
  Effect.gen(function* () {
    const { stage } = yield* Stack;
    const layer = stage.startsWith("preview-") ? yield* preview : local;
    const site = yield* Worker.pipe(Effect.provide(layer));
    return { url: site.url };
  }),
);

// oxlint-disable-next-line import/no-default-export -- The Alchemy CLI loads the stack from this entry’s default export.
export default stack;
