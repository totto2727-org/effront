import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import local, { Worker, workerLayer } from "./src/entry.workers";

const preview = Cloudflare.Worker.ref("effront-alchemy-cloudflare-app", {
  stage: "production",
}).pipe(Effect.map((parent) => workerLayer({ preview: { of: parent } })));

export default Stack(
  "effront-alchemy-cloudflare",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const { stage } = yield* Stack;
    const layer = stage.startsWith("preview-") ? yield* preview : local;
    const site = yield* Worker.pipe(Effect.provide(layer));
    return { url: site.url };
  }),
);
