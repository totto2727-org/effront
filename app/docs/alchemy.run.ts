import { Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import local, { Docs, docsWorker } from "./src/entry.workers";

const production = docsWorker({
  domain: { name: "effront.totto2727.dev", zoneName: "totto2727.dev" },
});
const preview = Cloudflare.Worker.ref("Docs", { stage: "production" }).pipe(
  Effect.map((parent) => docsWorker({ preview: { of: parent } })),
);

export default Stack(
  "effront-docs",
  { state: Cloudflare.state(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const { stage } = yield* Stack;
    const worker =
      stage === "production" ? production : stage.startsWith("preview-") ? yield* preview : local;
    const site = yield* Docs.pipe(Effect.provide(worker));
    return { url: site.url };
  }),
);
