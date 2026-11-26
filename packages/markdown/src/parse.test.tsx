import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { live } from "@effect/vitest";
import type { MarkdownDocument as Document, ParserOptions } from "comark";
import { Data, Effect, Option } from "effect";
import type { ComponentPropsWithoutRef, ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { assert, describe, expect } from "vite-plus/test";

import { createMarkdownCollection } from "./collection.ts";
import type { MarkdownEntry } from "./collection.ts";
import { MarkdownError, MarkdownParseError } from "./error.ts";
import { parseMarkdown } from "./parse.ts";

const entry = (content: string): Effect.Effect<MarkdownEntry, MarkdownError> =>
  Effect.gen(function* () {
    const collection = yield* createMarkdownCollection({
      assets: { "./logo.svg": "/assets/logo.hash.svg" },
      basePath: "/manual",
      documents: { "./guide.md": "# Guide", "./index.md": content },
    });
    const source = Option.fromUndefinedOr(collection.get("/manual/index"));
    return Option.getOrThrow(source);
  });

const parseSource = (
  content: string,
  options?: ParserOptions,
): Effect.Effect<Document, MarkdownError | MarkdownParseError> =>
  entry(content).pipe(Effect.flatMap((source) => parseMarkdown(source, options)));

const render = (element: ReactElement): Effect.Effect<string> =>
  Effect.promise(async () => {
    const stream = await renderToReadableStream(element);
    return new Response(stream).text();
  });

class TestPluginError extends Data.TaggedError("TestPluginError")<Readonly<{ message: string }>> {}

describe("markdown links and parser defaults", () => {
  live("resolves nested links and images in the Comark AST before rendering", () =>
    Effect.gen(function* () {
      const source = yield* entry("- [**Guide**](guide.md#top)\n\n[![Logo](logo.svg)](guide.md)");
      const document = yield* parseMarkdown(source);
      const serialized = JSON.stringify(document.nodes);
      expect(serialized).toContain('"href":"/manual/guide#top"');
      expect(serialized).toContain('"src":"/assets/logo.hash.svg"');
      expect(serialized).toContain('"href":"/manual/guide"');
      expect(source.content).toContain("(logo.svg)");
    }),
  );

  live("preserves Comark defaults including HTML, frontmatter, task lists, and attributes", () =>
    Effect.gen(function* () {
      const document = yield* parseSource(
        "---\ntitle: Guide\n---\n\n# Title\n\n<strong>HTML</strong>\n\n- [x] Done\n\n::note\nContent\n::",
      );
      expect(document.frontmatter["title"]).toBe("Guide");
      const serialized = JSON.stringify(document.nodes);
      expect(serialized).toContain('"strong"');
      expect(serialized).toContain('"id":"title"');
      expect(serialized).toContain('"checkbox"');
      expect(serialized).toContain('"note"');
    }),
  );
});

describe("markdown parser extensions", () => {
  live("keeps mdts plugins without substituting their AST output", () =>
    Effect.gen(function* () {
      const document = yield* parseSource(
        "Text[^1] and $x$.\n\n[^1]: Footnote.\n\n```mermaid\ngraph TD\n A --> B\n```\n\n```js\nconst answer = 42\n```",
      );
      const serialized = JSON.stringify(document.nodes);
      expect(serialized).toContain('["math",');
      expect(serialized).toContain('["mermaid",');
      expect(serialized).toContain("footnote");
      expect(serialized).toContain("shiki");
    }),
  );

  live("accepts standard parser options and runs user plugins before URL resolution", () =>
    Effect.gen(function* () {
      const document = yield* parseSource("# Heading", {
        headingIds: false,
        plugins: [
          {
            name: "append-link",
            post: ({ tree }) => {
              tree.nodes.push(["a", { href: "guide.md" }, "Guide"]);
            },
          },
        ],
      });
      expect(document.nodes[0]).toStrictEqual(["h1", {}, "Heading"]);
      expect(document.nodes.at(-1)).toStrictEqual(["a", { href: "/manual/guide" }, "Guide"]);
    }),
  );
});

describe("markdown parsing failures", () => {
  live("returns parser exceptions through MarkdownParseError with the original cause", () =>
    Effect.gen(function* () {
      const cause = new TestPluginError({ message: "plugin failed" });
      const error = yield* parseSource("hello", {
        plugins: [
          {
            name: "failed",
            pre: () => {
              throw cause;
            },
          },
        ],
      }).pipe(Effect.flip);
      assert.instanceOf(error, MarkdownParseError);
      expect(error.cause).toBe(cause);
    }),
  );

  live("returns unresolved references through MarkdownError", () =>
    Effect.gen(function* () {
      const error = yield* parseSource("[Missing](missing.md)").pipe(Effect.flip);
      expect(error).toBeInstanceOf(MarkdownError);
      expect(error.message).toContain("missing.md");
    }),
  );
});

const components = {
  ProseA: ({ href, children }: ComponentPropsWithoutRef<"a">): ReactElement => (
    <a data-custom="link" href={href}>
      {children}
    </a>
  ),
  img: ({ src, alt }: ComponentPropsWithoutRef<"img">): ReactElement => (
    <img data-custom="image" src={src} alt={alt} />
  ),
};

describe("parsed documents with the standard Comark renderer", () => {
  live("passes resolved URLs to caller components without wrapping or replacing them", () =>
    Effect.gen(function* () {
      const document = yield* parseSource("[Guide](guide.md)\n\n![Logo](logo.svg)");
      const html = yield* render(<MarkdownDocument value={document} components={components} />);
      expect(html).toContain('data-custom="link" href="/manual/guide"');
      expect(html).toContain('data-custom="image" src="/assets/logo.hash.svg"');
    }),
  );

  live("retains standard renderer output without Math or Mermaid SSR substitutions", () =>
    Effect.gen(function* () {
      const document = yield* parseSource("Inline $x$.\n\n```mermaid\ngraph TD\n A --> B\n```");
      const html = yield* render(<MarkdownDocument value={document} />);
      expect(html).toContain('<math class="math inline"');
      expect(html).toContain("<mermaid ");
      expect(html).not.toContain("katex");
      expect(html).not.toContain("<svg");
    }),
  );
});
