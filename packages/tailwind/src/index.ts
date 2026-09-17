import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { normalizePath, type Plugin, type PluginOption } from "vite";

const virtualStyle = "virtual:effront/tailwind.css";
const clientDirective =
  /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(["'])use client\1(?:\s*;|\s*\n|$)/;

export type EffrontTailwindOptions = {
  /** Optional CSS entry relative to the Vite root. Omit to generate Tailwind's default stylesheet. */
  readonly stylesheet?: string;
};

/** Includes @tailwindcss/vite and loads one stylesheet through React client boundaries. */
export const effrontTailwind = (options: EffrontTailwindOptions = {}): PluginOption[] => {
  if (options.stylesheet === "") throw new TypeError("A stylesheet path must not be empty.");
  let stylesheet: string;
  let generatedStyle: string;
  const integration: Plugin = {
    name: "effront:tailwind",
    enforce: "pre",
    configResolved(config) {
      // A CSS-shaped absolute ID lets Vite and Tailwind resolve imports from the app root.
      // The query keeps the generated module separate from any real style.css file.
      generatedStyle = normalizePath(resolve(config.root, "style.css")) + "?effront-tailwind";
      stylesheet =
        options.stylesheet === undefined
          ? virtualStyle
          : normalizePath(resolve(config.root, options.stylesheet));
    },
    resolveId(id) {
      if (id === virtualStyle) return generatedStyle;
      const [file, query = ""] = id.split("?", 2);
      if (file === "/style.css" && new URLSearchParams(query).has("effront-tailwind")) {
        return `${generatedStyle.split("?", 1)[0]}?${query}`;
      }
      return undefined;
    },
    load(id) {
      const [file, query = ""] = id.split("?", 2);
      if (
        file !== generatedStyle.split("?", 1)[0] ||
        !new URLSearchParams(query).has("effront-tailwind")
      )
        return;
      const tailwind = normalizePath(fileURLToPath(import.meta.resolve("tailwindcss/index.css")));
      return `@import ${JSON.stringify(tailwind)};`;
    },
    transform(code, id) {
      if (/[?&](?:raw|url|worker|sharedworker)(?:[=&]|$)/.test(id)) return;
      if (!/\.[cm]?[jt]sx?(?:\?|$)/.test(id) || !clientDirective.test(code)) return;
      // Keep the directive prologue intact. RSC collects the CSS from rendered client boundaries
      // for initial HTML as well as hydration; repeated imports share the same CSS module.
      return { code: `${code}\nimport ${JSON.stringify(stylesheet)};\n`, map: null };
    },
  };
  return [integration, ...tailwindcss()];
};
