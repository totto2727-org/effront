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
const manifestSources = import.meta.glob<string>("../../../../examples/{node,bun}/package.json", {
  eager: true,
  import: "default",
  query: "?raw",
});

export const nativeScripts = (host: (typeof nativeHosts)[number]): unknown => {
  const source = manifestSources[`../../../../examples/${host}/package.json`] ?? "{}";
  const parsed: unknown = JSON.parse(source);
  return Predicate.hasProperty(parsed, "scripts") ? parsed.scripts : undefined;
};

export const matchingTerms = (content: string, terms: string[]): string[] =>
  Array.filter(terms, (term) => content.includes(term));
