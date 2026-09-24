import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const tmp = join(root, "tmp");

await Promise.all([
  rm(join(root, ".vite-cache"), { recursive: true, force: true }),
  rm(join(tmp, "host.log"), { force: true }),
]);
await mkdir(tmp, { recursive: true });
