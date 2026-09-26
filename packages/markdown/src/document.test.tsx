import { renderToReadableStream } from "react-dom/server.edge";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { createMarkdownCollection } from "./collection.ts";
import { MarkdownDocument, type MarkdownDocumentProps } from "./document.tsx";
import { parseMarkdown } from "./parse.ts";

const entry = (content: string) =>
  Effect.runSync(
    createMarkdownCollection({
      basePath: "/manual",
      documents: { "./index.md": content },
    }),
  ).get("/manual/index")!;

const render = async (
  content: string,
  className?: string,
  components?: MarkdownDocumentProps["components"],
) => {
  const value = await Effect.runPromise(parseMarkdown(entry(content)));
  const documentProps = {
    value,
    ...(className ? { className } : {}),
    ...(components ? { components } : {}),
  };
  return new Response(await renderToReadableStream(<MarkdownDocument {...documentProps} />)).text();
};

describe("MarkdownDocument", () => {
  it("streams parsed documents with scoped and no-JavaScript rich-content placeholders", async () => {
    const html = await render("Inline $x$.\n\n```mermaid\nflowchart LR\n  A --> B\n```");
    expect(html).toContain('class="comark-content effront-markdown"');
    expect(html).toContain('<span class="math inline">...</span>');
    expect(html).toContain('<div class="mermaid"');
    expect(html).not.toContain("<svg");
    expect(html).not.toContain('class="katex');
  });

  it.each(["Math", "math", "ProseMath"])(
    "appends the caller class and preserves the %s component override",
    async (name) => {
      const html = await render("$x$", "article-prose", {
        [name]: ({ content }: { content: string }) => (
          <output data-custom-math="">{content}</output>
        ),
      });
      expect(html).toContain('class="comark-content effront-markdown article-prose"');
      expect(html).toContain('<output data-custom-math="">x</output>');
      expect(html).not.toContain('class="math');
    },
  );

  it.each(["Mermaid", "mermaid", "ProseMermaid"])(
    "preserves the %s component override instead of the default diagram leaf",
    async (name) => {
      const html = await render("```mermaid\nflowchart LR\n  A --> B\n```", undefined, {
        [name]: () => <output data-custom-diagram="">Custom diagram</output>,
      });
      expect(html).toContain('<output data-custom-diagram="">Custom diagram</output>');
      expect(html).not.toContain('class="mermaid');
    },
  );

  it("renders entirely server-side rich-component replacements without configured leaves", async () => {
    const html = await render("$x$\n\n```mermaid\nflowchart LR\n  A --> B\n```", undefined, {
      ProseMath: ({ content }: { content: string }) => (
        <output data-server-math="">{content}</output>
      ),
      ProseMermaid: () => <output data-server-mermaid="">Diagram</output>,
    });
    expect(html).toContain('<output data-server-math="">x</output>');
    expect(html).toContain('<output data-server-mermaid="">Diagram</output>');
    expect(html).not.toContain('class="math');
    expect(html).not.toContain('class="mermaid');
  });
});
