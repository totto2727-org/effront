import { BunRuntime } from "@effect/platform-bun";
import { serve } from "@effront/server/bun";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc";

serve(handler, {
  port: Number(process.env["PORT"] ?? "1343"),
  hostname: process.env["HOST"] ?? "127.0.0.1",
  assets: {
    client: {
      root: fileURLToPath(new URL("../client/assets", import.meta.url)),
      prefix: "/assets/",
      cacheControl: "public, max-age=31536000, immutable",
    },
  },
}).pipe(Layer.launch, BunRuntime.runMain);
