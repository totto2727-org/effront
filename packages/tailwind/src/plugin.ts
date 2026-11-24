// oxlint-disable-next-line rules/no-node-imports -- The synchronous Vite plugin resolves paths on the host before a runtime exists.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Tailwind's file URL must become a Vite path on the host.
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { normalizePath } from "vite";
import type { Plugin, PluginOption } from "vite";

const virtualStyle = "virtual:effront/tailwind.css";
const generatedQuery = "effront-tailwind";
const stylesheetName = "style.css";
const moduleRequestParts = 2;
const emptyPathLength = 0;
const clientDirective =
  /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?<quote>["'])use client\k<quote>(?:\s*;|\s*\n|$)/u;

export type EffrontTailwindOptions = Readonly<{
  /** Optional CSS entry relative to the Vite root. Omit to generate Tailwind's default stylesheet. */
  stylesheet?: string;
}>;

const getGeneratedQuery = (id: string, expectedFile: string): string => {
  const [file, query = ""] = id.split("?", moduleRequestParts);
  return file === expectedFile && new URLSearchParams(query).has(generatedQuery) ? query : "";
};

const tailwindImport = (): string => {
  const tailwind = normalizePath(fileURLToPath(import.meta.resolve("tailwindcss/index.css")));
  return `@import ${JSON.stringify(tailwind)};`;
};

// oxlint-disable-next-line unicorn/no-null -- A null Vite source map keeps existing mappings for the unchanged source.
const unchangedSourceMap = null;

/**
 * Includes the official Tailwind integration and loads one stylesheet through React client boundaries.
 * @param {EffrontTailwindOptions} options - An optional stylesheet relative to the Vite root.
 * @returns {PluginOption[]} The Effront plugin followed by the Tailwind Vite plugins.
 */
export const effrontTailwind = (options: EffrontTailwindOptions = {}): PluginOption[] => {
  if (options.stylesheet?.length === emptyPathLength) {
    // oxlint-disable-next-line rules/require-tagged-error -- Invalid plugin options use a native TypeError before Vite resolves its configuration.
    throw new TypeError("A stylesheet path must not be empty.");
  }
  const style = { generatedFile: "", stylesheet: virtualStyle };
  const integration: Plugin = {
    configResolved(config) {
      // A CSS-shaped absolute ID lets Vite and Tailwind resolve imports from the app root.
      // The query keeps the generated module separate from any real style.css file.
      style.generatedFile = normalizePath(path.resolve(config.root, stylesheetName));
      const stylesheet = options.stylesheet ?? "";
      style.stylesheet = stylesheet
        ? normalizePath(path.resolve(config.root, stylesheet))
        : virtualStyle;
    },
    enforce: "pre",
    load(id) {
      const query = getGeneratedQuery(id, style.generatedFile);
      return query ? tailwindImport() : undefined;
    },
    name: "effront:tailwind",
    resolveId(id) {
      const query =
        id === virtualStyle ? generatedQuery : getGeneratedQuery(id, `/${stylesheetName}`);
      return query ? `${style.generatedFile}?${query}` : undefined;
    },
    transform(code, id) {
      const isClientModule =
        !/[?&](?:raw|url|worker|sharedworker)(?:[=&]|$)/u.test(id) &&
        /\.[cm]?[jt]sx?(?:\?|$)/u.test(id) &&
        clientDirective.test(code);
      // Appending the import preserves the directive prologue and shares CSS with hydration.
      return isClientModule
        ? {
            code: `${code}\nimport ${JSON.stringify(style.stylesheet)};\n`,
            map: unchangedSourceMap,
          }
        : undefined;
    },
  };
  return [integration, ...tailwindcss()];
};
