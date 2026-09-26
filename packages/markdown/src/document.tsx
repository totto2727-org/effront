import { MarkdownDocument as ComarkMarkdownDocument } from "@comark/react/components/MarkdownDocument";
import type { MarkdownDocumentProps } from "@comark/react/components/MarkdownDocument";

import { Math } from "./math.tsx";
import { Mermaid } from "./mermaid.tsx";

import "./styles.css";

export type { MarkdownDocumentProps } from "@comark/react/components/MarkdownDocument";

/**
 * Browser-safe renderer for a document that was parsed with `parseMarkdown` in a server graph.
 *
 * Math and Mermaid are interactive Comark components. Their output is populated after hydration,
 * so server HTML and pages loaded without JavaScript contain their documented loading placeholders.
 */
export function MarkdownDocument({ className, components, ...props }: MarkdownDocumentProps) {
  return (
    <ComarkMarkdownDocument
      {...props}
      className={className ? `effront-markdown ${className}` : "effront-markdown"}
      components={{ Math, Mermaid, ...components }}
    />
  );
}
