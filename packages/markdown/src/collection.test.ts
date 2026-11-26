import { live } from "@effect/vitest";
import { Effect } from "effect";
import { MarkdownError } from "./error.ts";
import { assert, describe, expect } from "vite-plus/test";
import { createMarkdownCollection } from "./collection.ts";
import type { MarkdownCollection, MarkdownEntry } from "./collection.ts";

const collection = createMarkdownCollection({
  assets: {
    "./guides/diagram one.svg": "/assets/diagram-one.a1b2.svg",
    "./logo.svg": "/assets/logo.c3d4.svg",
  },
  basePath: "/manual",
  documents: {
    "./README.md": "# Read me",
    "./guides/$&+,=@.md": "# Punctuation",
    "./guides/100%.md": "# Percent",
    "./guides/advanced.md": "# Advanced",
    "./guides/getting started.md": "# Getting started",
    "./guides/index.md": "# Guides",
    "./index.md": "# Manual",
  },
});

const entryAt = (markdown: MarkdownCollection, pathname: string): MarkdownEntry => {
  const entry = markdown.get(pathname);
  assert.isDefined(entry, `Fixture missing ${pathname}`);
  return entry;
};

describe("document URL indexing", () => {
  live("maps nested documents to public routes by removing only the Markdown extension", () =>
    Effect.gen(function* () {
      const markdown = yield* collection;

      expect(markdown.entries.map(({ source, url }) => [source, url])).toStrictEqual([
        ["./guides/$&+,=@.md", "/manual/guides/%24%26%2B%2C%3D%40"],
        ["./guides/100%.md", "/manual/guides/100%25"],
        ["./guides/advanced.md", "/manual/guides/advanced"],
        ["./guides/getting started.md", "/manual/guides/getting%20started"],
        ["./guides/index.md", "/manual/guides/index"],
        ["./index.md", "/manual/index"],
        ["./README.md", "/manual/README"],
      ]);
      expect(markdown.entries.every((entry) => entry.pathname === entry.url)).toBe(true);
      const spaced = entryAt(markdown, "/manual/guides/getting%20started");
      expect(markdown.get("/manual/guides/getting started")).toBe(spaced);
      expect([
        spaced.content,
        markdown.get("/manual/guides/100%25")?.content,
        markdown.get("/manual/guides/%24%26%2B%2C%3D%40")?.url,
        markdown.get("/outside"),
      ]).toStrictEqual([
        "# Getting started",
        "# Percent",
        "/manual/guides/%24%26%2B%2C%3D%40",
        undefined,
      ]);
    }),
  );
});

describe("source map layouts", () => {
  live("uses the glob-base-relative hierarchy without stripping a source directory", () =>
    Effect.gen(function* () {
      const markdown = yield* createMarkdownCollection({
        assets: { "./images/diagram.svg": "/assets/diagram.hash.svg" },
        basePath: "/manual",
        documents: {
          "./content/index.md": "# Nested content",
          "./guide/deep/details.md": "# Details",
          "./index.md": "# Manual",
        },
      });
      const details = entryAt(markdown, "/manual/guide/deep/details");
      expect(markdown.get("/manual/content/index")?.source).toBe("./content/index.md");
      expect(details.source).toBe("./guide/deep/details.md");
      expect(yield* details.resolveLink("../../index.md#top")).toBe("/manual/index#top");
      expect(yield* details.resolveImage("../../images/diagram.svg")).toBe(
        "/assets/diagram.hash.svg",
      );
    }),
  );

  live("looks up URL-encoded filenames without interpreting them as route patterns", () =>
    Effect.gen(function* () {
      const markdown = yield* createMarkdownCollection({
        basePath: "/manual",
        documents: {
          "./:name.md": "# Colon",
          "./hash#.md": "# Hash",
          "./literal%20.md": "# Literal escape",
          "./what?.md": "# Question",
        },
      });
      expect(markdown.get("/manual/literal%2520")?.content).toBe("# Literal escape");
      expect(markdown.get("/manual/literal%20")).toBeUndefined();
      expect(markdown.get("/manual/what%3F")?.content).toBe("# Question");
      expect(markdown.get("/manual/hash%23")?.content).toBe("# Hash");
      expect(markdown.get("/manual/%3Aname")?.content).toBe("# Colon");
    }),
  );
});

describe("relative links and asset URLs", () => {
  live("resolves document URLs, queries, fragments, and Vite asset URLs", () =>
    Effect.gen(function* () {
      const markdown = yield* collection;
      const entry = entryAt(markdown, "/manual/guides/advanced");
      const resolved = yield* Effect.all([
        entry.resolveLink("index.md?mode=full#top"),
        markdown.resolveLink(entry, "getting%20started.md#install"),
        entry.resolveLink("100%25.md"),
        entry.resolveLink("?tab=examples#heading"),
        entry.resolveImage("diagram%20one.svg#icon"),
        markdown.resolveLink(entry, "../logo.svg?download=1"),
      ]);
      expect(resolved).toStrictEqual([
        "/manual/guides/index?mode=full#top",
        "/manual/guides/getting%20started#install",
        "/manual/guides/100%25",
        "/manual/guides/advanced?tab=examples#heading",
        "/assets/diagram-one.a1b2.svg#icon",
        "/assets/logo.c3d4.svg?download=1",
      ]);
    }),
  );
});

describe("application URL policy and Vite asset content", () => {
  live("leaves URL policy to Comark and the application", () =>
    Effect.gen(function* () {
      const markdown = yield* collection;
      const entry = entryAt(markdown, "/manual/guides/advanced");
      const references = [
        "https://example.com/?q=1#top",
        "mailto:hello@example.com",
        "/global.svg",
        "//cdn.example.com/logo.svg",
        "#details",
        "data:image/png;base64,AA==",
      ];
      const resolved = yield* Effect.forEach(references, (href) => entry.resolveLink(href));
      expect(resolved).toStrictEqual(references);
    }),
  );

  live("uses Vite's already-resolved asset URLs including inline assets", () =>
    Effect.gen(function* () {
      const markdown = yield* createMarkdownCollection({
        assets: { "./logo.svg": "data:image/svg+xml;base64,AAAA" },
        basePath: "/manual",
        documents: { "./index.md": "" },
      });
      expect(yield* entryAt(markdown, "/manual/index").resolveImage("logo.svg")).toBe(
        "data:image/svg+xml;base64,AAAA",
      );
    }),
  );
});

describe("invalid Markdown inputs and references", () => {
  live.each([
    { basePath: "/manual", documents: { "index.md": "" } },
    { basePath: "manual", documents: {} },
    { basePath: "/manual?query=1", documents: {} },
    { basePath: "/manual#heading", documents: {} },
    { basePath: "/manual/../outside", documents: {} },
    { basePath: "/manual", documents: { "../elsewhere/page.md": "" } },
    {
      basePath: "/manual",
      documents: { "./foo.MD": "", "./foo.md": "" },
    },
    { basePath: "/manual", documents: { "./file.txt": "" } },
    { basePath: "/manual", documents: { "./.md": "" } },
    {
      assets: { "../elsewhere/logo.svg": "/logo.svg" },
      basePath: "/manual",
      documents: {},
    },
  ])("returns configuration failures through the typed error channel: %j", (options) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(createMarkdownCollection(options));
      expect(error).toBeInstanceOf(MarkdownError);
      expect(error).not.toHaveProperty("cause");
    }),
  );

  live("returns missing and out-of-base references through the typed error channel", () =>
    Effect.gen(function* () {
      const markdown = yield* collection;
      const entry = entryAt(markdown, "/manual/guides/advanced");
      const operations = [
        entry.resolveLink("missing.md"),
        entry.resolveImage("missing.svg"),
        entry.resolveLink("../../../outside.md"),
        entry.resolveLink("%2F.md"),
      ];
      const failures = yield* Effect.forEach(operations, (operation) => Effect.flip(operation));
      expect(failures.every((failure) => failure instanceof MarkdownError)).toBe(true);
    }),
  );
});

describe("file stems, directories, and encoded references", () => {
  live("keeps file stems distinct from directories and supports an explicit manual page", () =>
    Effect.gen(function* () {
      const markdown = yield* createMarkdownCollection({
        basePath: "/",
        documents: {
          "./guide.md": "# Guide",
          "./guide/index.md": "# Guide index",
          "./index.md": "# Index",
          "./manual.md": "# Manual",
        },
      });
      expect(markdown.entries.map((entry) => entry.url)).toStrictEqual([
        "/guide",
        "/guide/index",
        "/index",
        "/manual",
      ]);
      expect(markdown.get("/")).toBeUndefined();
      expect(markdown.get("/manual")?.source).toBe("./manual.md");
      expect(yield* entryAt(markdown, "/guide/index").resolveLink("../guide.md")).toBe("/guide");
    }),
  );
});

describe("normalizing POSIX references", () => {
  live(
    "normalizes POSIX references while keeping URL-encoded separators and percents literal",
    () =>
      Effect.gen(function* () {
        const markdown = yield* createMarkdownCollection({
          basePath: "/manual",
          documents: {
            "./guide/back\\slash.md": "# POSIX backslash",
            "./guide/literal%2F.md": "# Literal slash escape",
            "./guide/start.md": "# Start",
            "./guide/日本語 space.md": "# Unicode",
          },
        });
        const start = entryAt(markdown, "/manual/guide/start");
        expect(yield* start.resolveLink("./nested/../literal%252F.md")).toBe(
          "/manual/guide/literal%252F",
        );
        expect(yield* start.resolveLink("back%5Cslash.md")).toBe("/manual/guide/back%5Cslash");
        expect(yield* start.resolveLink("日本語%20space.md")).toBe(
          "/manual/guide/%E6%97%A5%E6%9C%AC%E8%AA%9E%20space",
        );
        expect(yield* Effect.flip(start.resolveLink("literal%2F.md"))).toBeInstanceOf(
          MarkdownError,
        );
        expect(yield* Effect.flip(start.resolveLink("../../guide/start.md"))).toBeInstanceOf(
          MarkdownError,
        );
      }),
  );
});

describe("collection lifetime", () => {
  live("constructs a fresh collection on each Effect execution", () =>
    Effect.gen(function* () {
      const effect = createMarkdownCollection({
        basePath: "/",
        documents: { "./index.md": "# Home" },
      });
      expect(yield* effect).not.toBe(yield* effect);
    }),
  );
});
