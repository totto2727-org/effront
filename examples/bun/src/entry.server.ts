import { BunRuntime } from "@effect/platform-bun";
import { serve } from "@effront/server/bun";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc";

// This entry is emitted as dist/rsc/server.js. Paths do not depend on the launch directory.
serve(handler, {
  port: Number(process.env["PORT"] ?? "3000"),
  hostname: process.env["HOST"] ?? "127.0.0.1",
  assets: {
    client: {
      root: fileURLToPath(new URL("../client/assets", import.meta.url)),
      prefix: "/assets/",
      cacheControl: "public, max-age=31536000, immutable",
    },
    public: { root: fileURLToPath(new URL("../client", import.meta.url)) },
  },
}).pipe(Layer.launch, BunRuntime.runMain);
