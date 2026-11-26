import type { Plugin } from "vite-plus";

const buildTooling =
  /\/(?:packages\/cloudflare|node_modules\/@effront\/cloudflare)\/(?:src\/index\.ts|dist\/index\.js)|\/node_modules\/(?:@cloudflare\/vite-plugin|vite|wrangler)\//u;

export const acceptanceAudits = (): Plugin[] => [
  {
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle(_options, bundle) {
      const outputs = Object.values(bundle);
      this.emitFile({
        fileName: "acceptance-client-graph.json",
        source: JSON.stringify({
          assets: outputs
            .filter((output) => output.type === "asset")
            .map((output) => output.fileName),
          modules: outputs.flatMap((output) =>
            output.type === "chunk" ? Object.keys(output.modules) : [],
          ),
        }),
        type: "asset",
      });
    },
    name: "acceptance-client-graph",
  },
  {
    generateBundle() {
      [...this.getModuleIds()].forEach((moduleId) => {
        if (buildTooling.test(moduleId)) {
          this.error(`Build tooling leaked into an application module graph: ${moduleId}`);
        }
      });
    },
    name: "assert-runtime-package-boundary",
  },
];
