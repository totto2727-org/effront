import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { purePlugin } from "alchemy/Bundle/PurePlugin";
import { build, transformWithOxc, type Plugin } from "vite";

// These modules start local hosts, build deployment artifacts, or manage stack state.
// BrowserLocal and WorkerConfigProvider intentionally remain: they are runtime APIs.
const deploymentModules = new Set([
  "Providers",
  "StateStore/index",
  "StateStore/State",
  "Workers/Source",
  "Workers/RuntimeBindings",
  "Workers/WorkerProvider",
  "Workers/LocalWorkerProvider",
  "Containers/ContainerBundle",
  "Containers/ContainerProvider",
  "Containers/LocalContainerProvider",
  "KV/ReadNamespaceLocal",
  "KV/WriteNamespaceLocal",
  "KV/ReadWriteNamespaceLocal",
  "R2/ReadBucketLocal",
  "R2/WriteBucketLocal",
  "R2/ReadWriteBucketLocal",
  "D1/QueryDatabaseLocal",
]);

/**
 * TODO: Remove this development compatibility layer when Alchemy's runtime graph
 * no longer eagerly loads Node-only deployment code. Verify official cold-start
 * development, hydration, Server Functions and HMR before removing it.
 * Preserve unlisted exports. This is a deployment-code denylist, not a feature allowlist.
 */
export const alchemyRuntimeProjection = (): Plugin => {
  const root = dirname(dirname(fileURLToPath(import.meta.resolve("alchemy"))));
  const cloudflare = join(root, "src/Cloudflare");
  const prefix = "\0effront:alchemy-runtime:";
  const facadePrefix = "\0effront:alchemy-facade:";
  const cache = new Map<string, Promise<string>>();
  const excluded = (file: string) =>
    deploymentModules.has(relative(cloudflare, file).replace(/\.ts$/, ""));
  const facade = (file: string) => facadePrefix + file;

  const compile = async (entry: string) => {
    const result = await build({
      configFile: false,
      root,
      logLevel: "silent",
      define: { "globalThis.__ALCHEMY_RUNTIME__": "true" },
      resolve: { conditions: ["worker", "workerd", "module", "development"] },
      ssr: { noExternal: true },
      plugins: [
        {
          name: "effront:alchemy-deployment-filter",
          resolveId: (id) => (id.startsWith(facadePrefix) ? id : undefined),
          async load(id) {
            if (!id.startsWith(facadePrefix)) return;
            const file = id.slice(facadePrefix.length);
            if (excluded(file)) return "export {};";
            const original = readFileSync(file, "utf8");
            // Only actual infrastructure-provider factories are omitted. A runtime
            // ConfigProvider is not excluded just because its name ends in Provider.
            const transformed = await transformWithOxc(original, file);
            const ast = this.parse(transformed.code);
            const providerNamespaces = new Set(
              ast.body.flatMap((node) =>
                node.type === "ImportDeclaration" &&
                /\/(?:Provider|Local\/(?:ProviderLayer|RpcProvider|LocalProvider))\.[jt]s$/.test(
                  String(node.source.value),
                )
                  ? node.specifiers
                      .filter((specifier) => specifier.type === "ImportNamespaceSpecifier")
                      .map((specifier) => specifier.local.name)
                  : [],
              ),
            );
            const providers = new Set<string>();
            for (const node of ast.body) {
              if (
                node.type !== "ExportNamedDeclaration" ||
                node.declaration?.type !== "VariableDeclaration"
              )
                continue;
              for (const declaration of node.declaration.declarations) {
                const init = declaration.init;
                const body = init?.type === "ArrowFunctionExpression" ? init.body : init;
                if (
                  declaration.id.type === "Identifier" &&
                  body?.type === "CallExpression" &&
                  body.callee.type === "MemberExpression" &&
                  body.callee.object.type === "Identifier" &&
                  providerNamespaces.has(body.callee.object.name)
                )
                  providers.add(declaration.id.name);
              }
            }
            const lines: string[] = [];
            const target = async (source: string) => {
              if (!source.startsWith(".")) {
                const resolved = await this.resolve(source, file);
                if (!resolved) throw new TypeError(`Cannot resolve Alchemy re-export: ${source}`);
                return resolved.id;
              }
              const path = resolve(dirname(file), source.replace(/\.js$/, ".ts"));
              return path.startsWith(cloudflare + "/") ? facade(path) : path;
            };
            for (const node of ast.body) {
              if (node.type === "ExportAllDeclaration") {
                const next = await target(String(node.source.value));
                lines.push(
                  `export *${node.exported ? ` as ${node.exported.type === "Identifier" ? node.exported.name : JSON.stringify(node.exported.value)}` : ""} from ${JSON.stringify(next)};`,
                );
              } else if (node.type === "ExportNamedDeclaration") {
                if (node.declaration) {
                  const declaration = node.declaration;
                  const names =
                    declaration.type === "VariableDeclaration"
                      ? declaration.declarations.map((value) => {
                          if (value.id.type !== "Identifier")
                            throw new TypeError(`Unsupported Alchemy export pattern in ${file}`);
                          return value.id.name;
                        })
                      : (declaration.type === "FunctionDeclaration" ||
                            declaration.type === "ClassDeclaration") &&
                          declaration.id
                        ? [declaration.id.name]
                        : [];
                  const kept = names.filter((name) => !providers.has(name));
                  if (kept.length)
                    lines.push(`export { ${kept.join(", ")} } from ${JSON.stringify(file)};`);
                } else {
                  const kept = node.specifiers.filter(
                    (value) =>
                      !providers.has(
                        value.local.type === "Identifier"
                          ? value.local.name
                          : String(value.local.value),
                      ),
                  );
                  const names = kept.map(
                    (value) =>
                      `${value.local.type === "Identifier" ? value.local.name : JSON.stringify(value.local.value)} as ${value.exported.type === "Identifier" ? value.exported.name : JSON.stringify(value.exported.value)}`,
                  );
                  if (names.length)
                    lines.push(
                      `export { ${names.join(", ")} } from ${JSON.stringify(node.source ? await target(String(node.source.value)) : file)};`,
                    );
                }
              } else if (node.type === "ExportDefaultDeclaration") {
                lines.push(`export { default } from ${JSON.stringify(file)};`);
              }
            }
            return lines.join("\n");
          },
        },
        purePlugin(),
      ],
      build: {
        ssr: true,
        write: false,
        minify: false,
        rolldownOptions: {
          input: facade(entry),
          external: (id) =>
            id === "effect" ||
            id.startsWith("effect/") ||
            id.startsWith("node:") ||
            id.startsWith("cloudflare:") ||
            builtinModules.includes(id),
          output: { format: "es", codeSplitting: false },
        },
      },
    });
    if ("on" in result) throw new TypeError("Unexpected Alchemy runtime build watcher.");
    const output = Array.isArray(result) ? result.flatMap((value) => value.output) : result.output;
    const chunks = output.filter((value) => value.type === "chunk");
    if (chunks.length !== 1) throw new TypeError("Expected one Alchemy runtime module.");
    return chunks[0]!.code;
  };

  return {
    name: "effront:alchemy-runtime-projection",
    apply: "serve",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.name === "rsc" || environment.name === "ssr",
    resolveId(id) {
      if (id !== "alchemy/Cloudflare" && !id.startsWith("alchemy/Cloudflare/")) return;
      const resolved = fileURLToPath(import.meta.resolve(id));
      const source = resolved.replace(join(root, "lib"), join(root, "src")).replace(/\.js$/, ".ts");
      if (!existsSync(source)) throw new TypeError(`Alchemy runtime module is missing: ${source}`);
      if (excluded(source))
        throw new TypeError(`Alchemy deployment-only module is unavailable in a Worker: ${id}`);
      return prefix + source;
    },
    load(id) {
      if (!id.startsWith(prefix)) return;
      const entry = id.slice(prefix.length);
      let code = cache.get(entry);
      if (!code) cache.set(entry, (code = compile(entry)));
      return code;
    },
  };
};
