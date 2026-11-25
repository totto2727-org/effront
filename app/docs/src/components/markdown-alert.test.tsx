import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";

import { markdownAlertComponents } from "./markdown-alert.ts";

const render = Effect.fn("renderMarkdownAlert")(function* (markdown: string) {
  const collection = yield* createMarkdownCollection({
    basePath: "/",
    documents: { "./alert.md": markdown },
  });
  const entry = yield* Effect.fromNullishOr(collection.get("/alert"));
  const document = yield* parseMarkdown(entry);
  return renderToStaticMarkup(
    <MarkdownDocument value={document} components={markdownAlertComponents} />,
  );
});

describe("rendering Markdown alerts", () => {
  it.effect.each(["Note", "Tip", "Important", "Warning", "Caution"])(
    "%s uses the standard Comark marker and renders a named icon callout",
    (title) =>
      Effect.gen(function* () {
        const marker = `[!${title.toUpperCase()}]`;
        const html = yield* render(`> ${marker}\n> Keep this **important content**.`);
        const fragments = [
          `data-alert="${title.toLowerCase()}"`,
          `aria-label="${title}"`,
          `</svg>${title}</p>`,
          'aria-hidden="true"',
          "<strong>important content</strong>",
        ];
        expect(fragments.filter((fragment) => !html.includes(fragment))).toStrictEqual([]);
        expect(html).not.toContain(marker);
      }),
  );

  it.effect("leaves ordinary quotations unchanged", () =>
    Effect.gen(function* () {
      const html = yield* render("> This is an ordinary quotation.");
      expect(html).toContain("<blockquote>");
      expect(html).not.toContain("docs-alert");
      expect(html).not.toContain("<svg");
    }),
  );

  it.effect("does not invent an unsupported error alert type", () =>
    Effect.gen(function* () {
      const html = yield* render("> [!ERROR]\n> An unsupported marker.");
      expect(html).toContain("<blockquote>");
      expect(html).not.toContain("docs-alert");
    }),
  );
});
