import { NodeRuntime } from "@effect/platform-node";
import { serve } from "@effront/server/node";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc";

serve(handler, {
  port: Number(process.env["PORT"] ?? "18220"),
  hostname: process.env["HOST"] ?? "127.0.0.1",
  assets: {
    client: {
      root: fileURLToPath(new URL("../client/assets", import.meta.url)),
      prefix: "/assets/",
      cacheControl: "public, max-age=31536000, immutable",
    },
    public: { root: fileURLToPath(new URL("../client", import.meta.url)) },
  },
}).pipe(Layer.launch, NodeRuntime.runMain);
