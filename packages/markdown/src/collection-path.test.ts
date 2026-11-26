import { live } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { createMarkdownCollection } from "./collection.ts";

const collection = createMarkdownCollection({
  basePath: "/manual",
  documents: {
    "./guides/advanced.md": "# Advanced",
    "./guides/index.md": "# Guides",
    "./index.md": "# Manual",
  },
});

const root = createMarkdownCollection({ basePath: "/", documents: { "./index.md": "# Root" } });

describe("noncanonical route aliases", () => {
  live.each([
    "/manual/guides%2Fadvanced",
    "/manual/guides%2fadvanced",
    "/manual/guides%5Cadvanced",
    String.raw`/manual/guides\advanced`,
    "/manual/guides/advanced%00",
    "/manual/guides/advanced\0",
    "/manual/guides/%2E/advanced",
    "/manual/guides/./advanced",
    "/manual/guides/%2E%2E",
    "/manual/guides/../guides/advanced",
    "/manual//guides/advanced",
    "//manual/guides/advanced",
    "/manual/guides/advanced//",
    "/manual//",
    "/manual/guides/%",
    "/manual/guides/%E0%A4",
  ])("returns undefined for an unknown pathname without throwing: %s", (pathname) =>
    Effect.gen(function* () {
      const markdown = yield* collection;
      expect(markdown.get(pathname)).toBeUndefined();
    }),
  );

  live.each(["/manual/index/", "/manual/guides/index/", "/manual/guides/advanced/"])(
    "preserves a single trailing slash alias: %s",
    (pathname) =>
      Effect.gen(function* () {
        const markdown = yield* collection;
        expect(markdown.get(pathname)).toBe(markdown.get(pathname.slice(0, -1)));
        expect(markdown.get(pathname)).toBeDefined();
      }),
  );
});

describe("index documents and literal escapes", () => {
  live.each(["/index", "/index?mode=full#top"])(
    "looks up index.md at its explicit pathname: %s",
    (pathname) =>
      Effect.gen(function* () {
        const markdown = yield* root;
        expect(markdown.get(pathname)?.content).toBe("# Root");
      }),
  );

  live.each(["/", "/?mode=full#top", "//", "///", "/./", "/%2E/", "/%00", "/%2F"])(
    "does not alias root or unknown paths to index.md: %s",
    (pathname) =>
      Effect.gen(function* () {
        const markdown = yield* root;
        expect(markdown.get(pathname)).toBeUndefined();
      }),
  );

  live.each(["%2F", "%5C", "%00", "%2E", "%", "%E0%A4"])(
    "looks up a literal escape filename after decoding once: %s",
    (filename) =>
      Effect.gen(function* () {
        const markdown = yield* createMarkdownCollection({
          basePath: "/manual",
          documents: { [`./${filename}.md`]: "# Literal escape" },
        });
        expect(markdown.get(`/manual/${encodeURIComponent(filename)}`)?.content).toBe(
          "# Literal escape",
        );
      }),
  );
});
