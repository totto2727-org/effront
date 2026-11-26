import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite-plus";

import type { markdownAlertComponents } from "#docs/components/markdown-alert.ts";

export const alertTitles = ["Note", "Tip", "Important", "Warning", "Caution"] as const;
export type AlertTitle = (typeof alertTitles)[number];

const fixtureMarkdown = [
  "> An ordinary quotation.",
  ...alertTitles.map(
    (title) => `> [!${title.toUpperCase()}]\n> ${title} content with **readable details**.`,
  ),
].join("\n\n");

const parseFixture = Effect.fn("parseAlertBrowserFixture")(function* () {
  const collection = yield* createMarkdownCollection({
    basePath: "/",
    documents: { "./alerts.md": fixtureMarkdown },
  });
  const entry = yield* Effect.fromNullishOr(collection.get("/alerts"));
  return yield* parseMarkdown(entry);
});

export const buildAlertFixture = async (): Promise<string> => {
  // oxlint-disable-next-line rules/no-effect-runtime-run -- A Playwright worker owns this independent Markdown fixture workflow.
  const document = await Effect.runPromise(parseFixture());
  // Vite preserves the production React JSX during this Playwright fixture load.
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    server: { middlewareMode: true },
  });
  try {
    const module = await vite.ssrLoadModule("/src/components/markdown-alert.ts");
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Vite exposes a dynamic namespace for this fixed production module.
    const components: typeof markdownAlertComponents = module["markdownAlertComponents"];
    return renderToStaticMarkup(
      createElement(MarkdownDocument, { className: "docs-markdown", components, value: document }),
    );
  } finally {
    await vite.close();
  }
};
