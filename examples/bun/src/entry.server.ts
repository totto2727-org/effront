import { BunRuntime } from "@effect/platform-bun";
import { serve } from "@effront/server/bun";
import { Layer, String } from "effect";
// oxlint-disable-next-line rules/no-node-imports -- The host asset adapter requires a platform-native filesystem path.
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc.ts";

// oxlint-disable-next-line node/no-process-env -- The host supplies optional process-level bind settings.
const { PORT: port = "", HOST: hostname = "" } = process.env;

const server = serve(handler, {
  ...(String.isNonEmpty(port) ? { port: Number(port) } : {}),
  ...(String.isNonEmpty(hostname) ? { hostname } : {}),
  assets: {
    client: {
      cacheControl: "public, max-age=31536000, immutable",
      prefix: "/assets/",
      root: fileURLToPath(new URL("../client/assets", import.meta.url)),
    },
  },
});

// oxlint-disable-next-line rules/no-effect-runtime-run -- This platform entry point owns the server process.
BunRuntime.runMain(Layer.launch(server));
