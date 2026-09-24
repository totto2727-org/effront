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
  return new Response(
    await renderToReadableStream(
      <MarkdownDocument className={className} components={components} value={value} />,
    ),
  ).text();
};

describe("MarkdownDocument", () => {
  it("renders parsed documents with its scoped class and Comark's no-JS rich-content placeholders", async () => {
    const html = await render("Inline $x$.\n\n```mermaid\nflowchart LR\n  A --> B\n```");
    expect(html).toContain('class="comark-content effront-markdown"');
    expect(html).toContain('<span class="math inline">...</span>');
    expect(html).toContain('<div class="mermaid "');
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("katex");
  });

  it("appends the caller class and preserves caller component overrides", async () => {
    const html = await render("$x$", "article-prose", {
      Math: ({ content }: { content: string }) => <output data-custom-math="">{content}</output>,
    });
    expect(html).toContain('class="comark-content effront-markdown article-prose"');
    expect(html).toContain('<output data-custom-math="">x</output>');
  });
});
