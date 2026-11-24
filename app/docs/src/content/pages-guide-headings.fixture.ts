import { Array } from "effect";

import type { DocLocale } from "./locale.ts";

export const editions = ["en", "ja"] as const;

const rawArticles = import.meta.glob<string>(
  [
    "./{articles,en/articles}/best-practices/{authentication-and-authorization,server-function-error-handling,testing}.md",
    "./{articles,en/articles}/advanced/{request-runtime-and-lifetimes,server-function-execution-and-refresh}.md",
    "./{articles,en/articles}/api-reference/server-functions.md",
  ],
  { eager: true, import: "default", query: "?raw" },
);

export const publishedHeadings = [
  {
    ids: ["entry-points", "shared-policy", "authorization"],
    slug: "/best-practices/authentication-and-authorization",
  },
  { ids: ["expected", "operational"], slug: "/best-practices/server-function-error-handling" },
  {
    ids: ["resource-design", "request-layer", "response-lifetime"],
    slug: "/advanced/request-runtime-and-lifetimes",
  },
  {
    ids: ["tools", "routes", "pages", "layouts", "server-functions"],
    slug: "/best-practices/testing",
  },
  {
    ids: ["execution", "result-and-refresh", "concurrency"],
    slug: "/advanced/server-function-execution-and-refresh",
  },
  {
    ids: ["make", "arguments", "execution", "request-protocol"],
    slug: "/api-reference/server-functions",
  },
];

const registeredHeading = /^#{2,6} (?<title>.*?) \{#(?<id>[^}]+)\}$/gmu;

export const authoredHeadings = (
  locale: DocLocale,
  slug: string,
): Readonly<{ id: string | undefined; title: string | undefined }>[] => {
  const directory = locale === "en" ? "en/articles" : "articles";
  const source = rawArticles[`./${directory}${slug}.md`] ?? "";
  const matches = Array.fromIterable(source.matchAll(registeredHeading));
  return Array.map(matches, ({ groups }) => ({
    id: groups?.["id"],
    title: groups?.["title"]?.replaceAll("`", ""),
  }));
};

export const renderedAnchors = [
  { ids: ["services", "production"], slug: "/best-practices/testing" },
  { ids: ["render-scope"], slug: "/advanced/request-runtime-and-lifetimes" },
  { ids: ["input-boundary"], slug: "/advanced/server-function-execution-and-refresh" },
];
