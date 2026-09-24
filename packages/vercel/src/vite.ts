import { isBuiltin } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { effrontServer } from "@effront/server/vite";
import type { PluginOption, Plugin } from "vite";
import { writeBuildOutput } from "./output";

const serverEntry = "virtual:effront/vercel-server";
const applicationEntry = "virtual:effront/vercel-application";
const runtimeEntry = fileURLToPath(new URL("./runtime.js", import.meta.url));
// plugin-rsc rewrites these imports in renderChunk, but chunk metadata retains
// the placeholder IDs. Its buildApp hook writes the actual sibling manifests.
const generatedManifests = new Set([
  "virtual:vite-rsc/assets-manifest",
  "virtual:vite-rsc/env-imports-manifest",
]);

export interface EffrontVercelOptions {
  /** Native Effect HTTP handler entry, shared with development. */
  readonly rsc?: string;
}

/** Register after effront(), instead of effrontServer(). Produces Build Output API v3. */
export const effrontVercel = (options: EffrontVercelOptions = {}): PluginOption[] => {
  const rsc = options.rsc ?? "./src/entry.rsc.ts";
  let root: string;
  const output: Plugin = {
    name: "effront:vercel",
    config(config, environment) {
      const root = config.root ?? process.cwd();
      return {
        build: { outDir: resolve(root, "dist/vercel/client") },
        environments: {
          client: { build: { outDir: resolve(root, "dist/vercel/client") } },
          rsc: {
            ...(environment.command === "build" ? { resolve: { noExternal: true } } : {}),
            build: { outDir: resolve(root, "dist/vercel/rsc") },
          },
          ssr: {
            ...(environment.command === "build" ? { resolve: { noExternal: true } } : {}),
            build: { outDir: resolve(root, "dist/vercel/ssr") },
          },
        },
      };
    },
    configResolved(config) {
      root = config.root;
      if (config.command !== "build") return;
      if (config.base !== "/") {
        throw new TypeError("effrontVercel requires Vite base '/'.");
      }
      for (const name of ["rsc", "ssr", "client"]) {
        const environment = config.environments[name];
        if (
          environment === undefined ||
          resolve(root, environment.build.outDir) !== resolve(root, `dist/vercel/${name}`)
        ) {
          throw new TypeError(`effrontVercel owns the ${name} output directory.`);
        }
      }
    },
    resolveId(id) {
      if (id === serverEntry) return `\0${serverEntry}`;
      if (id === applicationEntry) return resolve(root, rsc);
      return;
    },
    load(id) {
      if (id !== `\0${serverEntry}`) return;
      return `import { createHandler } from ${JSON.stringify(runtimeEntry)};
import { handler as application } from ${JSON.stringify(applicationEntry)};
const { handler } = await createHandler(application);
export default handler;
`;
    },
    generateBundle(_options, bundle) {
      if (!["rsc", "ssr"].includes(this.environment.name)) return;
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const id of [...chunk.imports, ...chunk.dynamicImports]) {
          if (!Object.hasOwn(bundle, id) && !isBuiltin(id) && !generatedManifests.has(id)) {
            this.error(`Vercel output requires bundled dependencies, but ${id} is external.`);
          }
        }
      }
    },
    buildApp: {
      order: "post",
      async handler() {
        await writeBuildOutput(root);
      },
    },
  };
  return [effrontServer({ rsc, server: serverEntry }), output];
};
