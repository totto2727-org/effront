import footnotes from "comark/plugins/footnotes";
import math from "comark/plugins/math";
import mermaid from "comark/plugins/mermaid";
import shiki from "comark/plugins/shiki";
import { parseMarkdown as parseComark } from "comark";
import type { MarkdownDocument, Node, ParserOptions } from "comark";
import { Effect, Predicate } from "effect";

import type { MarkdownEntry } from "./collection.ts";
import { MarkdownParseError } from "./error.ts";
import type { MarkdownError } from "./error.ts";

const defaultPlugins = [
  footnotes(),
  math(),
  mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" }),
  shiki(),
];

const resolveNode = (entry: MarkdownEntry, node: Node): Effect.Effect<void, MarkdownError> =>
  Effect.gen(function* () {
    if (Predicate.isString(node) || Predicate.isNullish(node[0])) {
      return;
    }
    const [tag, attributes, ...children] = node;
    const { href, src } = attributes;
    if (tag === "a" && Predicate.isString(href)) {
      attributes["href"] = yield* entry.resolveLink(href);
    }
    if (tag === "img" && Predicate.isString(src)) {
      attributes["src"] = yield* entry.resolveImage(src);
    }
    yield* Effect.forEach(children, (child) => resolveNode(entry, child), { discard: true });
  });

/**
 * Parses trusted Markdown with Comark and resolves file references recursively.
 * @param {MarkdownEntry} entry The source entry and its link and image resolvers.
 * @param {ParserOptions} options The Comark parser options and additional plugins.
 * @returns {Effect.Effect<MarkdownDocument, MarkdownError | MarkdownParseError>} The parsed document with resolved links and images.
 */
export const parseMarkdown = (
  entry: MarkdownEntry,
  options: ParserOptions = {},
): Effect.Effect<MarkdownDocument, MarkdownError | MarkdownParseError> =>
  Effect.gen(function* () {
    const document = yield* Effect.tryPromise({
      catch: (cause) =>
        new MarkdownParseError({ cause, message: `Failed to parse Markdown: ${entry.source}` }),
      try: async () =>
        parseComark(entry.content, {
          ...options,
          plugins: [...defaultPlugins, ...(options.plugins ?? [])],
        }),
    });
    yield* Effect.forEach(document.nodes, (node) => resolveNode(entry, node), { discard: true });
    return document;
  });
