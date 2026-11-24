import { MarkdownDocument as ComarkMarkdownDocument } from "@comark/react/components/MarkdownDocument";
import type { MarkdownDocumentProps } from "@comark/react/components/MarkdownDocument";
import { Predicate, String } from "effect";
import { createElement } from "react";
import type { ReactElement } from "react";

import { Math } from "./math.tsx";
import { Mermaid } from "./mermaid.tsx";

// oxlint-disable-next-line import/no-unassigned-import -- The document entrypoint installs its bundled Markdown styles.
import "./styles.css";

export type { MarkdownDocumentProps } from "@comark/react/components/MarkdownDocument";

/**
 * Renders parsed Markdown with Comark and provides browser-loaded Math and Mermaid components.
 * @param {MarkdownDocumentProps} input The parsed document and any caller renderer overrides.
 * @returns {ReactElement} A Comark document with the Effront wrapper class.
 */
// oxlint-disable-next-line eslint/func-style -- The React rule requires a function declaration for this component.
export function MarkdownDocument(input: MarkdownDocumentProps): ReactElement {
  const { className, components, ...props } = input;
  const wrapperClass =
    Predicate.isNotNullish(className) && String.isNonEmpty(className)
      ? `effront-markdown ${className}`
      : "effront-markdown";
  return createElement(ComarkMarkdownDocument, {
    ...props,
    className: wrapperClass,
    components: { Math, Mermaid, ...components },
  });
}
