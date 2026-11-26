import { BunRuntime } from "@effect/platform-bun";
import { serve } from "@effront/server/bun";
import { Config, Effect, Layer } from "effect";
// oxlint-disable-next-line rules/no-node-imports -- The native server needs filesystem paths derived from the emitted module URL.
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc.ts";

const defaultPort = 3000;
const listenAddress = Config.all({
  hostname: Config.String("HOST").pipe(Config.withDefault("127.0.0.1")),
  port: Config.String("PORT").pipe(Config.map(Number), Config.withDefault(defaultPort)),
});

// This entry is emitted as dist/rsc/server.js. Paths do not depend on the launch directory.
const assets = {
  client: {
    cacheControl: "public, max-age=31536000, immutable",
    prefix: "/assets/",
    root: fileURLToPath(new URL("../client/assets", import.meta.url)),
  },
  public: { root: fileURLToPath(new URL("../client", import.meta.url)) },
};

const main = Effect.gen(function* () {
  const { hostname, port } = yield* listenAddress;
  yield* Layer.launch(
    serve(handler, {
      assets,
      hostname,
      port,
    }),
  );
});

// oxlint-disable-next-line rules/no-effect-runtime-run -- This compiled server module is the native process entrypoint.
BunRuntime.runMain(main);
