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

const stack = Stack(
  "effront-docs",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const { stage } = yield* Stack;
    const other = stage.startsWith("preview-") ? yield* preview : local;
    const worker = stage === "production" ? production : other;
    const site = yield* Docs.pipe(Effect.provide(worker));
    return { url: site.url };
  }),
);

// oxlint-disable-next-line import/no-default-export -- The Alchemy CLI consumes this stack from the default export.
export default stack;
