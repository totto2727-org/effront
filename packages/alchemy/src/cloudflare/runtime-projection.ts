import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

/**
 * beta.77's public Cloudflare barrels also export Node-only deployment providers.
 * The dev optimizer preserves every barrel export, including workerd's binary
 * loader. Project only the supported Worker/KV runtime exports before optimizing.
 * Tooling construction and production application imports remain unchanged.
 */
export const alchemyRuntimeProjection = (): Plugin => {
  const root = dirname(dirname(fileURLToPath(import.meta.resolve("alchemy"))));
  const metadata = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    version?: string;
  };
  if (metadata.version !== "2.0.0-beta.77") {
    throw new TypeError("Effront's Alchemy runtime projection requires alchemy@2.0.0-beta.77.");
  }

  const projections = new Map<string, string>();
  for (const [directory, extension] of [
    ["src", "ts"],
    ["lib", "js"],
  ] as const) {
    const base = join(root, directory, "Cloudflare");
    const modulePath = (path: string) => {
      const absolute = join(base, `${path}.${extension}`);
      if (!existsSync(absolute)) {
        throw new TypeError(`Alchemy runtime module is missing: ${absolute}`);
      }
      return JSON.stringify(absolute);
    };
    projections.set(
      join(base, `index.${extension}`),
      [
        `export { Worker, WorkerEnvironment, WorkerExecutionContext } from ${modulePath("Workers/Worker")};`,
        `export { Request } from ${modulePath("Workers/Request")};`,
        `export { makeWorkerBridge } from ${modulePath("Workers/WorkerBridge")};`,
        `export { CloudflareEnvironment } from ${modulePath("CloudflareEnvironment")};`,
        `export * as KV from ${modulePath("KV/index")};`,
      ].join("\n"),
    );
    projections.set(
      join(base, "Workers", `index.${extension}`),
      [
        `export { Worker, WorkerEnvironment, WorkerExecutionContext, fromExecutionContext, deferredExecutionContext } from ${modulePath("Workers/Worker")};`,
        `export { Request } from ${modulePath("Workers/Request")};`,
        `export { makeWorkerBridge } from ${modulePath("Workers/WorkerBridge")};`,
      ].join("\n"),
    );
    projections.set(
      join(base, "KV", `index.${extension}`),
      [
        `export { Namespace } from ${modulePath("KV/Namespace")};`,
        ...["ReadNamespace", "WriteNamespace", "ReadWriteNamespace"].flatMap((name) => [
          `export { ${name} } from ${modulePath(`KV/${name}`)};`,
          `export { ${name}Binding } from ${modulePath(`KV/${name}Binding`)};`,
        ]),
      ].join("\n"),
    );
  }

  return {
    name: "effront:alchemy-runtime-projection",
    load(id) {
      const code = projections.get(id);
      return code === undefined ? undefined : { code, moduleSideEffects: false };
    },
  };
};
