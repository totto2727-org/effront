import { live } from "@effect/vitest";
import { Effect } from "effect";
import { MarkdownError } from "./error.ts";
import { describe, expect } from "vite-plus/test";
import { createMarkdownCollection } from "./collection.ts";

const collection = createMarkdownCollection({
  basePath: "/manual",
  documents: {
    "./README.md": "# Read me",
    "./index.md": "# Manual",
    "./guides/index.md": "# Guides",
    "./guides/advanced.md": "# Advanced",
    "./guides/getting started.md": "# Getting started",
    "./guides/100%.md": "# Percent",
    "./guides/$&+,=@.md": "# Punctuation",
  },
  assets: {
    "./guides/diagram one.svg": "/assets/diagram-one.a1b2.svg",
    "./logo.svg": "/assets/logo.c3d4.svg",
  },
});

describe("createMarkdownCollection", () => {
  live("maps nested documents to public routes by removing only the Markdown extension", () =>
    Effect.gen(function* () {
      const markdown = yield* collection;

      expect(
        markdown.entries.map((entry) => [entry.source, entry.pathname, entry.url]),
      ).toStrictEqual([
        [
          "./guides/$&+,=@.md",
          "/manual/guides/%24%26%2B%2C%3D%40",
          "/manual/guides/%24%26%2B%2C%3D%40",
        ],
        ["./guides/100%.md", "/manual/guides/100%25", "/manual/guides/100%25"],
        ["./guides/advanced.md", "/manual/guides/advanced", "/manual/guides/advanced"],
        [
          "./guides/getting started.md",
          "/manual/guides/getting%20started",
          "/manual/guides/getting%20started",
        ],
        ["./guides/index.md", "/manual/guides/index", "/manual/guides/index"],
        ["./index.md", "/manual/index", "/manual/index"],
        ["./README.md", "/manual/README", "/manual/README"],
      ]);
      expect(markdown.get("/manual/guides/getting%20started")?.content).toBe("# Getting started");
      expect(markdown.get("/manual/guides/getting started")).toBe(
        markdown.get("/manual/guides/getting%20started"),
      );
      expect(markdown.get("/manual/guides/100%25")?.content).toBe("# Percent");
      expect(markdown.get("/manual/guides/%24%26%2B%2C%3D%40")?.url).toBe(
        "/manual/guides/%24%26%2B%2C%3D%40",
      );
      expect(markdown.get("/outside")).toBeUndefined();
    }),
  );

  live("uses the glob-base-relative hierarchy without stripping a source directory", () =>
    Effect.gen(function* () {
      const markdown = yield* createMarkdownCollection({
        basePath: "/manual",
        documents: {
          "./index.md": "# Manual",
          "./content/index.md": "# Nested content",
          "./guide/deep/details.md": "# Details",
        },
        assets: { "./images/diagram.svg": "/assets/diagram.hash.svg" },
      });
      const details = markdown.get("/manual/guide/deep/details")!;
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
          "./literal%20.md": "# Literal escape",
          "./what?.md": "# Question",
          "./hash#.md": "# Hash",
          "./:name.md": "# Colon",
        },
      });
      expect(markdown.get("/manual/literal%2520")?.content).toBe("# Literal escape");
      expect(markdown.get("/manual/literal%20")).toBeUndefined();
      expect(markdown.get("/manual/what%3F")?.content).toBe("# Question");
      expect(markdown.get("/manual/hash%23")?.content).toBe("# Hash");
      expect(markdown.get("/manual/%3Aname")?.content).toBe("# Colon");
    }),
  );

  live.each([
    "/manual/guides%2Fadvanced",
    "/manual/guides%2fadvanced",
    "/manual/guides%5Cadvanced",
    "/manual/guides\\advanced",
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

  live.each(["/index", "/index?mode=full#top"])(
    "looks up index.md at its explicit pathname: %s",
    (pathname) =>
      Effect.gen(function* () {
        const markdown = yield* createMarkdownCollection({
          basePath: "/",
          documents: { "./index.md": "# Root" },
        });
        expect(markdown.get(pathname)?.content).toBe("# Root");
      }),
  );

  live.each(["/", "/?mode=full#top", "//", "///", "/./", "/%2E/", "/%00", "/%2F"])(
    "does not alias root or unknown paths to index.md: %s",
    (pathname) =>
      Effect.gen(function* () {
        const markdown = yield* createMarkdownCollection({
          basePath: "/",
          documents: { "./index.md": "# Root" },
        });
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

  live("resolves document URLs, queries, fragments, and Vite asset URLs", () =>
    Effect.gen(function* () {
      const markdown = yield* collection;
      const entry = markdown.get("/manual/guides/advanced")!;
      expect(yield* entry.resolveLink("index.md?mode=full#top")).toBe(
        "/manual/guides/index?mode=full#top",
      );
      expect(yield* markdown.resolveLink(entry, "getting%20started.md#install")).toBe(
        "/manual/guides/getting%20started#install",
      );
      expect(yield* entry.resolveLink("100%25.md")).toBe("/manual/guides/100%25");
      expect(yield* entry.resolveLink("?tab=examples#heading")).toBe(
        "/manual/guides/advanced?tab=examples#heading",
      );
      expect(yield* entry.resolveImage("diagram%20one.svg#icon")).toBe(
        "/assets/diagram-one.a1b2.svg#icon",
      );
      expect(yield* markdown.resolveLink(entry, "../logo.svg?download=1")).toBe(
        "/assets/logo.c3d4.svg?download=1",
      );
    }),
  );

  live("leaves URL policy to Comark and the application", () =>
    Effect.gen(function* () {
      const markdown = yield* collection;
      const entry = markdown.get("/manual/guides/advanced")!;
      for (const href of [
        "https://example.com/?q=1#top",
        "mailto:hello@example.com",
        "/global.svg",
        "//cdn.example.com/logo.svg",
        "#details",
        "data:image/png;base64,AA==",
      ]) {
        expect(yield* entry.resolveLink(href)).toBe(href);
      }
    }),
  );

  live("uses Vite's already-resolved asset URLs including inline assets", () =>
    Effect.gen(function* () {
      const markdown = yield* createMarkdownCollection({
        basePath: "/manual",
        documents: { "./index.md": "" },
        assets: { "./logo.svg": "data:image/svg+xml;base64,AAAA" },
      });
      expect(yield* markdown.get("/manual/index")!.resolveImage("logo.svg")).toBe(
        "data:image/svg+xml;base64,AAAA",
      );
    }),
  );

  live.each([
    { basePath: "/manual", documents: { "index.md": "" } },
    { basePath: "manual", documents: {} },
    { basePath: "/manual?query=1", documents: {} },
    { basePath: "/manual#heading", documents: {} },
    { basePath: "/manual/../outside", documents: {} },
    { basePath: "/manual", documents: { "../elsewhere/page.md": "" } },
    {
      basePath: "/manual",
      documents: { "./foo.md": "", "./foo.MD": "" },
    },
    { basePath: "/manual", documents: { "./file.txt": "" } },
    { basePath: "/manual", documents: { "./.md": "" } },
    {
      basePath: "/manual",
      documents: {},
      assets: { "../elsewhere/logo.svg": "/logo.svg" },
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
      const entry = markdown.get("/manual/guides/advanced")!;
      for (const operation of [
        entry.resolveLink("missing.md"),
        entry.resolveImage("missing.svg"),
        entry.resolveLink("../../../outside.md"),
        entry.resolveLink("%2F.md"),
      ]) {
        expect(yield* Effect.flip(operation)).toBeInstanceOf(MarkdownError);
      }
    }),
  );

  live("keeps file stems distinct from directories and supports an explicit manual page", () =>
    Effect.gen(function* () {
      const markdown = yield* createMarkdownCollection({
        basePath: "/",
        documents: {
          "./manual.md": "# Manual",
          "./guide.md": "# Guide",
          "./guide/index.md": "# Guide index",
          "./index.md": "# Index",
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
      expect(yield* markdown.get("/guide/index")!.resolveLink("../guide.md")).toBe("/guide");
    }),
  );

  live(
    "normalizes POSIX references while keeping URL-encoded separators and percents literal",
    () =>
      Effect.gen(function* () {
        const markdown = yield* createMarkdownCollection({
          basePath: "/manual",
          documents: {
            "./guide/start.md": "# Start",
            "./guide/literal%2F.md": "# Literal slash escape",
            "./guide/back\\slash.md": "# POSIX backslash",
            "./guide/日本語 space.md": "# Unicode",
          },
        });
        const start = markdown.get("/manual/guide/start")!;
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
