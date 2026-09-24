import { BunRuntime } from "@effect/platform-bun";
import { serve } from "@effront/server/bun";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc";

const port = process.env["PORT"];
const hostname = process.env["HOST"];

serve(handler, {
  ...(port ? { port: Number(port) } : {}),
  ...(hostname ? { hostname } : {}),
  assets: {
    client: {
      root: fileURLToPath(new URL("../client/assets", import.meta.url)),
      prefix: "/assets/",
      cacheControl: "public, max-age=31536000, immutable",
    },
  },
}).pipe(Layer.launch, BunRuntime.runMain);
