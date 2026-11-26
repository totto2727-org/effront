// oxlint-disable-next-line rules/no-node-imports -- The Vite build host reads the installed package's resolved source files.
import { access, readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The compiler leaves Node built-ins external according to the current host.
import { builtinModules } from "node:module";
// oxlint-disable-next-line rules/no-node-imports -- Vite resolves and classifies modules using host filesystem paths.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Vite's Node resolver returns file URLs for the installed package.
import { fileURLToPath } from "node:url";

import { purePlugin } from "alchemy/Bundle/PurePlugin";
import { build, normalizePath, transformWithOxc } from "vite";
import type { Plugin } from "vite";

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

type LoadHook = Extract<NonNullable<Plugin["load"]>, (id: string) => unknown>;
type PluginContext = ThisParameterType<LoadHook>;
type Statement = ReturnType<PluginContext["parse"]>["body"][number];
type NamedExport = Extract<Statement, { type: "ExportNamedDeclaration" }>;
type ExportName = NamedExport["specifiers"][number]["local"];
type ExportDeclaration = NonNullable<NamedExport["declaration"]>;
type VariableBinding = Extract<
  ExportDeclaration,
  { type: "VariableDeclaration" }
>["declarations"][number];
type ResolveTarget = (source: string) => Promise<string>;

interface ProjectionPaths {
  cloudflare: string;
  root: string;
}

interface FacadeExports {
  file: string;
  providers: ReadonlySet<string>;
  resolveTarget: ResolveTarget;
}

const prefix = "\0effront:alchemy-runtime:";
const facadePrefix = "\0effront:alchemy-facade:";
const providerImport = /\/(?:Provider|Local\/(?:ProviderLayer|RpcProvider|LocalProvider))\.[jt]s$/u;
const facade = (file: string): string => `${facadePrefix}${file}`;

const projectionFailure = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native error type reported by Vite's compiler hooks.
  new TypeError(message);

const isExcluded = ({ cloudflare }: ProjectionPaths, file: string): boolean =>
  deploymentModules.has(normalizePath(path.relative(cloudflare, file)).replace(/\.ts$/u, ""));

const namespacesFor = (node: Statement): string[] => {
  if (node.type !== "ImportDeclaration" || !providerImport.test(node.source.value)) {
    return [];
  }
  return node.specifiers.flatMap((specifier) =>
    specifier.type === "ImportNamespaceSpecifier" ? [specifier.local.name] : [],
  );
};

const providerBinding = (binding: VariableBinding, namespaces: ReadonlySet<string>): string[] => {
  const { id, init } = binding;
  const body = init?.type === "ArrowFunctionExpression" ? init.body : init;
  if (
    id.type === "Identifier" &&
    body?.type === "CallExpression" &&
    body.callee.type === "MemberExpression" &&
    body.callee.object.type === "Identifier" &&
    namespaces.has(body.callee.object.name)
  ) {
    return [id.name];
  }
  return [];
};

const providerExports = (statements: Statement[]): ReadonlySet<string> => {
  const namespaces = new Set(statements.flatMap((statement) => namespacesFor(statement)));
  // Exclude imported infrastructure-provider factories. Keep ordinary runtime configuration exports.
  return new Set(
    statements.flatMap((node) =>
      node.type === "ExportNamedDeclaration" && node.declaration?.type === "VariableDeclaration"
        ? node.declaration.declarations.flatMap((binding) => providerBinding(binding, namespaces))
        : [],
    ),
  );
};

const exportName = (name: ExportName): string =>
  name.type === "Identifier" ? name.name : JSON.stringify(name.value);

const declaredNames = (declaration: ExportDeclaration, file: string): string[] => {
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.map(({ id }) => {
      if (id.type !== "Identifier") {
        throw projectionFailure(`Unsupported Alchemy export pattern in ${file}`);
      }
      return id.name;
    });
  }
  if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
    return declaration.id ? [declaration.id.name] : [];
  }
  return [];
};

const resolveFacadeTarget =
  (context: PluginContext, { cloudflare }: ProjectionPaths, file: string): ResolveTarget =>
  async (source) => {
    if (!source.startsWith(".")) {
      const resolved = await context.resolve(source, file);
      if (!resolved) {
        throw projectionFailure(`Cannot resolve Alchemy re-export: ${source}`);
      }
      return resolved.id;
    }
    const target = path.resolve(path.dirname(file), source.replace(/\.js$/u, ".ts"));
    return target.startsWith(`${cloudflare}${path.sep}`) ? facade(target) : target;
  };

const renderNamedExport = async (
  node: NamedExport,
  { file, providers, resolveTarget }: FacadeExports,
): Promise<string> => {
  if (node.declaration) {
    const names = declaredNames(node.declaration, file);
    const kept = names.filter((name) => !providers.has(name));
    return kept.length ? `export { ${kept.join(", ")} } from ${JSON.stringify(file)};` : "";
  }
  const kept = node.specifiers.filter(
    ({ local }) => !providers.has(local.type === "Identifier" ? local.name : local.value),
  );
  if (!kept.length) {
    return "";
  }
  const names = kept.map(
    ({ local, exported }) => `${exportName(local)} as ${exportName(exported)}`,
  );
  const target = node.source ? await resolveTarget(node.source.value) : file;
  return `export { ${names.join(", ")} } from ${JSON.stringify(target)};`;
};

const renderExport = async (node: Statement, projection: FacadeExports): Promise<string> => {
  if (node.type === "ExportAllDeclaration") {
    const target = await projection.resolveTarget(node.source.value);
    const alias = node.exported ? ` as ${exportName(node.exported)}` : "";
    return `export *${alias} from ${JSON.stringify(target)};`;
  }
  if (node.type === "ExportNamedDeclaration") {
    return renderNamedExport(node, projection);
  }
  return node.type === "ExportDefaultDeclaration"
    ? `export { default } from ${JSON.stringify(projection.file)};`
    : "";
};

const projectFacade = async (
  context: PluginContext,
  paths: ProjectionPaths,
  file: string,
): Promise<string> => {
  if (isExcluded(paths, file)) {
    return "export {};";
  }
  const original = await readFile(file, "utf8");
  const transformed = await transformWithOxc(original, file);
  const { body } = context.parse(transformed.code);
  const projected = {
    file,
    providers: providerExports(body),
    resolveTarget: resolveFacadeTarget(context, paths, file),
  };
  const lines: string[] = [];
  // oxlint-disable-next-line rules/no-for-loops -- Re-exports share the Vite plugin resolver and must be resolved in source order.
  for (const node of body) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for the current host resolution before moving to the next declaration.
    lines.push(await renderExport(node, projected));
  }
  return lines.filter(Boolean).join("\n");
};

const facadePlugin = (paths: ProjectionPaths): Plugin => ({
  async load(id) {
    return id.startsWith(facadePrefix)
      ? projectFacade(this, paths, id.slice(facadePrefix.length))
      : undefined;
  },
  name: "effront:alchemy-deployment-filter",
  resolveId: (id) => (id.startsWith(facadePrefix) ? id : undefined),
});

const external = (id: string): boolean =>
  id === "effect" ||
  id.startsWith("effect/") ||
  id.startsWith("node:") ||
  id.startsWith("cloudflare:") ||
  builtinModules.includes(id);

const compile = async (paths: ProjectionPaths, entry: string): Promise<string> => {
  const result = await build({
    build: {
      minify: false,
      rolldownOptions: {
        external,
        input: facade(entry),
        output: { codeSplitting: false, format: "es" },
      },
      ssr: true,
      write: false,
    },
    configFile: false,
    define: { "globalThis.__ALCHEMY_RUNTIME__": "true" },
    logLevel: "silent",
    plugins: [facadePlugin(paths), purePlugin()],
    resolve: { conditions: ["worker", "workerd", "module", "development"] },
    root: paths.root,
    ssr: { noExternal: true },
  });
  if ("on" in result) {
    throw projectionFailure("Unexpected Alchemy runtime build watcher.");
  }
  const output = Array.isArray(result) ? result.flatMap((value) => value.output) : result.output;
  const [chunk, ...extra] = output.filter((value) => value.type === "chunk");
  if (!chunk || extra.length) {
    throw projectionFailure("Expected one Alchemy runtime module.");
  }
  return chunk.code;
};

const sourceFor = async (paths: ProjectionPaths, id: string): Promise<string> => {
  const resolved = fileURLToPath(import.meta.resolve(id));
  const source = resolved
    .replace(path.join(paths.root, "lib"), path.join(paths.root, "src"))
    .replace(/\.js$/u, ".ts");
  try {
    await access(source);
  } catch {
    throw projectionFailure(`Alchemy runtime module is missing: ${source}`);
  }
  if (isExcluded(paths, source)) {
    throw projectionFailure(`Alchemy deployment-only module is unavailable in a Worker: ${id}`);
  }
  return `${prefix}${source}`;
};

/**
 * TODO: Remove this compatibility layer when Alchemy's runtime graph
 * no longer eagerly loads Node-only deployment code. Verify official cold-start
 * development, hydration, Server Functions, HMR and built Worker acceptance before removing it.
 * @returns {Plugin} The runtime projection plugin for the RSC and SSR graphs.
 */
export const alchemyRuntimeProjection = (): Plugin => {
  const main = fileURLToPath(import.meta.resolve("alchemy"));
  const root = path.dirname(path.dirname(main));
  const paths = { cloudflare: path.join(root, "src/Cloudflare"), root };
  const cache = new Map<string, Promise<string>>();

  // oxlint-disable-next-line typescript/promise-function-async -- Returning the cached promise preserves identity across concurrent loads.
  const compileEntry = (entry: string): Promise<string> => {
    const existing = cache.get(entry);
    if (existing) {
      return existing;
    }
    const code = compile(paths, entry);
    cache.set(entry, code);
    return code;
  };
  return {
    applyToEnvironment: (environment) => environment.name === "rsc" || environment.name === "ssr",
    enforce: "pre",
    // oxlint-disable-next-line typescript/promise-function-async -- Concurrent loads must share the exact cached compile promise.
    load: (id) => (id.startsWith(prefix) ? compileEntry(id.slice(prefix.length)) : undefined),
    name: "effront:alchemy-runtime-projection",
    async resolveId(id) {
      return id === "alchemy/Cloudflare" || id.startsWith("alchemy/Cloudflare/")
        ? sourceFor(paths, id)
        : undefined;
    },
  };
};
