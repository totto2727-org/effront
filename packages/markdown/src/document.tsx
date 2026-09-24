import { MarkdownDocument as ComarkMarkdownDocument } from "@comark/react/components/MarkdownDocument";
import type { MarkdownDocumentProps } from "@comark/react/components/MarkdownDocument";

import { MarkdownMath } from "./math.tsx";
import { MarkdownMermaid } from "./mermaid.tsx";

import "./styles.css";

export type { MarkdownDocumentProps } from "@comark/react/components/MarkdownDocument";

/**
 * Browser-safe renderer for a document that was parsed with `parseMarkdown` in a server graph.
 *
 * Math and Mermaid are interactive Comark components. Their output is populated after hydration,
 * so server HTML and pages loaded without JavaScript contain their documented loading placeholders.
 */
export function MarkdownDocument({ className, components, ...props }: MarkdownDocumentProps) {
  const hasOverride = (name: "Math" | "Mermaid") =>
    Boolean(components?.[`Prose${name}`] ?? components?.[name.toLowerCase()] ?? components?.[name]);
  const defaults = {
    ...(hasOverride("Math") ? {} : { Math: MarkdownMath }),
    ...(hasOverride("Mermaid") ? {} : { Mermaid: MarkdownMermaid }),
  };
  const rendererProps = {
    ...props,
    ...(className
      ? { className: ["effront-markdown", className].join(" ") }
      : { className: "effront-markdown" }),
    components: { ...defaults, ...components },
  } as MarkdownDocumentProps;
  return <ComarkMarkdownDocument {...rendererProps} />;
}
