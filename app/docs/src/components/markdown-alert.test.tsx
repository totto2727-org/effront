import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { markdownAlertComponents } from "./markdown-alert";

async function render(markdown: string) {
  const collection = await Effect.runPromise(
    createMarkdownCollection({ basePath: "/", documents: { "./alert.md": markdown } }),
  );
  const entry = collection.get("/alert");
  if (!entry) throw new TypeError("Alert fixture is missing");
  const document = await Effect.runPromise(parseMarkdown(entry));
  return renderToStaticMarkup(
    <MarkdownDocument value={document} components={markdownAlertComponents} />,
  );
}

it.each(["Note", "Tip", "Important", "Warning", "Caution"])(
  "%s uses the standard Comark marker and renders a named icon callout",
  async (title) => {
    const html = await render(`> [!${title.toUpperCase()}]\n> Keep this **important content**.`);
    expect(html).toContain(`data-alert="${title.toLowerCase()}"`);
    expect(html).toContain(`aria-label="${title}"`);
    expect(html).toContain(`</svg>${title}</p>`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<strong>important content</strong>");
    expect(html).not.toContain(`[!${title.toUpperCase()}]`);
  },
);

it("leaves ordinary quotations unchanged", async () => {
  const html = await render("> This is an ordinary quotation.");
  expect(html).toContain("<blockquote>");
  expect(html).not.toContain("docs-alert");
  expect(html).not.toContain("<svg");
});

it("does not invent an unsupported error alert type", async () => {
  const html = await render("> [!ERROR]\n> An unsupported marker.");
  expect(html).toContain("<blockquote>");
  expect(html).not.toContain("docs-alert");
});
