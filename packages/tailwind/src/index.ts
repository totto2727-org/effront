import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizePath, type Plugin, type PluginOption } from "vite";

const virtualStyle = "virtual:effront/tailwind.css";
const clientDirective =
  /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(["'])use client\1(?:\s*;|\s*\n|$)/;

export type EffrontTailwindOptions = {
  /** Application root for dependency resolution; defaults to the current working directory. */
  readonly root?: string;
  /** Optional CSS entry relative to the Vite root. Omit to generate Tailwind's default stylesheet. */
  readonly stylesheet?: string;
};

type ApplicationManifest = {
  readonly dependencies?: Record<string, unknown>;
  readonly devDependencies?: Record<string, unknown>;
};

const declares = (manifest: ApplicationManifest, name: string) =>
  Object.hasOwn(manifest.dependencies ?? {}, name) ||
  Object.hasOwn(manifest.devDependencies ?? {}, name);

/** Enables the application's own Tailwind Vite plugin only when both packages are declared. */
export const effrontTailwind = async (
  options: EffrontTailwindOptions = {},
): Promise<PluginOption[]> => {
  if (options.stylesheet === "") throw new TypeError("A stylesheet path must not be empty.");
  const root = resolve(options.root ?? process.cwd());
  const manifestPath = resolve(root, "package.json");
  let manifest: ApplicationManifest;
  try {
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new TypeError("Application package.json must contain an object.");
    }
    manifest = parsed as ApplicationManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") manifest = {};
    else
      throw new Error(`Cannot read application dependencies from ${manifestPath}`, {
        cause: error,
      });
  }
  const hasTailwind = declares(manifest, "tailwindcss");
  const hasPlugin = declares(manifest, "@tailwindcss/vite");
  const enabled = hasTailwind && hasPlugin;
  if (hasTailwind !== hasPlugin) {
    const missing = hasTailwind ? "@tailwindcss/vite" : "tailwindcss";
    console.warn(`Effront Tailwind: add ${missing} to ${manifestPath} to enable Tailwind.`);
  }

  let cssPath: string | undefined;
  let tailwindPlugins: PluginOption[] = [];
  if (enabled) {
    const require = createRequire(manifestPath);
    let pluginPath: string;
    try {
      pluginPath = require.resolve("@tailwindcss/vite");
      cssPath = normalizePath(require.resolve("tailwindcss/index.css"));
    } catch (error) {
      throw new Error(`Install the declared Tailwind dependencies in ${root}`, { cause: error });
    }
    const { default: tailwindcss } = (await import(
      pathToFileURL(pluginPath).href
    )) as typeof import("@tailwindcss/vite");
    tailwindPlugins = tailwindcss();
  }

  let stylesheet: string;
  let generatedStyle: string;
  const integration: Plugin = {
    name: "effront:tailwind",
    enforce: "pre",
    configResolved(config) {
      generatedStyle = normalizePath(resolve(config.root, "style.css")) + "?effront-tailwind";
      stylesheet =
        options.stylesheet === undefined
          ? virtualStyle
          : normalizePath(resolve(config.root, options.stylesheet));
    },
    resolveId(id) {
      if (!enabled) return;
      if (id === virtualStyle) return generatedStyle;
      const [file, query = ""] = id.split("?", 2);
      if (file === "/style.css" && new URLSearchParams(query).has("effront-tailwind")) {
        return `${generatedStyle.split("?", 1)[0]}?${query}`;
      }
      return undefined;
    },
    load(id) {
      if (!enabled) return;
      const [file, query = ""] = id.split("?", 2);
      if (
        file !== generatedStyle.split("?", 1)[0] ||
        !new URLSearchParams(query).has("effront-tailwind")
      )
        return;
      return `@import ${JSON.stringify(cssPath)};`;
    },
    transform(code, id) {
      if (!enabled && options.stylesheet === undefined) return;
      if (/[?&](?:raw|url|worker|sharedworker)(?:[=&]|$)/.test(id)) return;
      if (!/\.[cm]?[jt]sx?(?:\?|$)/.test(id) || !clientDirective.test(code)) return;
      // Rendered client boundaries carry CSS into initial HTML and hydration.
      return { code: `${code}\nimport ${JSON.stringify(stylesheet)};\n`, map: null };
    },
  };
  return [integration, ...tailwindPlugins];
};
