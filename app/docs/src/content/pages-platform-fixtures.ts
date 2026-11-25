import { Array, Predicate } from "effect";

export const locales = ["en", "ja"] as const;
export const nativeHosts = ["node", "bun"] as const;
export const installGuides = [
  "/guide/getting-started",
  "/platforms/node",
  "/platforms/bun",
  "/platforms/cloudflare",
  "/platforms/alchemy",
];
const exampleSources = import.meta.glob<string>(
  "../../../../examples/{node,bun,cloudflare,alchemy-cloudflare}/{package.json,vite.config.ts,src/{entry.effront.tsx,entry.workers.ts}}",
  { eager: true, import: "default", query: "?raw" },
);

export const exampleSource = (example: string, path: string): string =>
  exampleSources[`../../../../examples/${example}/${path}`] ?? "";

export const nativeScripts = (host: (typeof nativeHosts)[number]): unknown => {
  const source = exampleSource(host, "package.json");
  const parsed: unknown = JSON.parse(source);
  return Predicate.hasProperty(parsed, "scripts") ? parsed.scripts : undefined;
};

export const matchingTerms = (content: string, terms: string[]): string[] =>
  Array.filter(terms, (term) => content.includes(term));
