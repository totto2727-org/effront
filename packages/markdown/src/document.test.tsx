import { renderToReadableStream } from "react-dom/server.edge";
import { live } from "@effect/vitest";
import { Effect, Option } from "effect";
import { describe, expect } from "vite-plus/test";

import { createMarkdownCollection } from "./collection.ts";
import { MarkdownDocument } from "./document.tsx";
import type { MarkdownDocumentProps } from "./document.tsx";
import type { MarkdownError, MarkdownParseError } from "./error.ts";
import { parseMarkdown } from "./parse.ts";

const render = (
  content: string,
  className = "",
  components: NonNullable<MarkdownDocumentProps["components"]> = {},
): Effect.Effect<string, MarkdownError | MarkdownParseError> =>
  Effect.gen(function* () {
    const collection = yield* createMarkdownCollection({
      basePath: "/manual",
      documents: { "./index.md": content },
    });
    const found = Option.fromUndefinedOr(collection.get("/manual/index"));
    const entry = Option.getOrThrow(found);
    const value = yield* parseMarkdown(entry);
    return yield* Effect.promise(async () => {
      const stream = await renderToReadableStream(
        // oxlint-disable-next-line react/forbid-component-props -- The renderer exposes a className prop and this test checks its composition.
        <MarkdownDocument value={value} className={className} components={components} />,
      );
      return new Response(stream).text();
    });
  });

describe("rendering Markdown documents", () => {
  live("streams parsed documents with scoped and no-JavaScript rich-content placeholders", () =>
    Effect.gen(function* () {
      const html = yield* render("Inline $x$.\n\n```mermaid\nflowchart LR\n  A --> B\n```");
      expect(html).toContain('class="comark-content effront-markdown"');
      expect(html).toContain('<span class="math inline">...</span>');
      expect(html).toContain('<div class="mermaid"');
      expect(html).not.toContain("<svg");
      expect(html).not.toContain('class="katex');
    }),
  );

  live.each(["Math", "math", "ProseMath"])(
    "appends the caller class and preserves the %s component override",
    (name) =>
      Effect.gen(function* () {
        const html = yield* render("$x$", "article-prose", {
          [name]: ({ content }: { content: string }) => (
            <output data-custom-math="">{content}</output>
          ),
        });
        expect(html).toContain('class="comark-content effront-markdown article-prose"');
        expect(html).toContain('<output data-custom-math="">x</output>');
        expect(html).not.toContain('class="math');
      }),
  );
});

describe("diagram and combined component overrides", () => {
  live.each(["Mermaid", "mermaid", "ProseMermaid"])(
    "preserves the %s component override instead of the default diagram leaf",
    (name) =>
      Effect.gen(function* () {
        const html = yield* render("```mermaid\nflowchart LR\n  A --> B\n```", undefined, {
          [name]: () => <output data-custom-diagram="">Custom diagram</output>,
        });
        expect(html).toContain('<output data-custom-diagram="">Custom diagram</output>');
        expect(html).not.toContain('class="mermaid');
      }),
  );

  live("renders entirely server-side rich-component replacements without configured leaves", () =>
    Effect.gen(function* () {
      const html = yield* render("$x$\n\n```mermaid\nflowchart LR\n  A --> B\n```", undefined, {
        ProseMath: ({ content }: { content: string }) => (
          <output data-server-math="">{content}</output>
        ),
        ProseMermaid: () => <output data-server-mermaid="">Diagram</output>,
      });
      expect(html).toContain('<output data-server-math="">x</output>');
      expect(html).toContain('<output data-server-mermaid="">Diagram</output>');
      expect(html).not.toContain('class="math');
      expect(html).not.toContain('class="mermaid');
    }),
  );
});
