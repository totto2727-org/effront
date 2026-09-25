import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";

const directory = process.argv[2];
if (!directory)
  throw new Error(
    "Usage: node packages/alchemy/scripts/rebuild-runtime-patch.mjs <patch-directory>",
  );
const root = resolve(directory);
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (manifest.name !== "@alchemy.run/cloudflare-runtime" || manifest.version !== "2.0.0-beta.77") {
  throw new Error(
    "This host artifact recipe targets @alchemy.run/cloudflare-runtime@2.0.0-beta.77 only",
  );
}

// Keep the published core, Worker artifacts and dynamic server chunks intact.
// Rebuild the host plugin from its patched TypeScript, including its source map.
const bundle = await rolldown({
  input: resolve(root, "src/vite/plugin.ts"),
  platform: "node",
  plugins: [
    {
      name: "runtime-public-boundaries",
      resolveId(source, importer) {
        if (!source.startsWith(".") && !source.startsWith("/"))
          return { id: source, external: true };
        if (!importer) return undefined;
        const path = resolve(dirname(importer), source);
        const local = relative(resolve(root, "src"), path).replaceAll("\\", "/");
        if (local.startsWith("rolldown/")) {
          return {
            id: `@alchemy.run/cloudflare-runtime/${local.replace(/\.ts$/, "").replace(/\/index$/, "")}`,
            external: true,
          };
        }
        if (local === "vite/dev-server.ts")
          return { id: "./dev-server-BpqsxQjQ.mjs", external: true };
        if (local === "vite/preview-server.ts")
          return { id: "./preview-server-CnppxSHY.mjs", external: true };
        return undefined;
      },
    },
  ],
});
try {
  await bundle.write({
    file: resolve(root, "dist/vite/node/plugin.mjs"),
    format: "esm",
    sourcemap: true,
  });
} finally {
  await bundle.close();
}
