import { Array } from "effect";

import type { DocLocale } from "./locale.ts";

export const editions = ["en", "ja"] as const;

const articles = import.meta.glob<string>(
  [
    "./{articles,en/articles}/guide/getting-started.md",
    "./{articles,en/articles}/platforms/{node,bun,cloudflare,alchemy}.md",
  ],
  { eager: true, import: "default", query: "?raw" },
);

export const startupSource = (locale: DocLocale, article: string): string => {
  const directory = locale === "en" ? "en/articles" : "articles";
  return articles[`./${directory}/${article}.md`] ?? "";
};

const shellSequence = /```bash\n(?<source>[\s\S]*?)\n```/gu;
export const shellExamples = (article: string): (string | undefined)[] => {
  const matches = Array.fromIterable(article.matchAll(shellSequence));
  return Array.map(matches, ({ groups }) => groups?.["source"]);
};

export const startupCases = [
  { article: "platforms/node", command: "vp dev" },
  { article: "platforms/bun", command: "vp dev" },
  { article: "platforms/cloudflare", command: "vp dev" },
  { article: "platforms/alchemy", command: "vp run dev" },
];

export const quickstartCommands =
  "vp create effront -- my-app --platform node\ncd my-app\nvp install\nvp dev";
