import { MarkdownDocument } from "@effront/markdown/document";
import type { ComponentProps, JSX } from "react";

import { markdownAlertComponents } from "#docs/components/markdown-alert.ts";
import type { DocLocale } from "./locale.ts";
import { createArticleLink } from "./markdown-link.tsx";
import { MarkdownPre } from "./markdown-pre.tsx";

type DocumentProps = ComponentProps<typeof MarkdownDocument>;
export type MarkdownComponents = NonNullable<DocumentProps["components"]>;

export const defaultComponents: MarkdownComponents = {
  ProsePre: MarkdownPre,
  ...markdownAlertComponents,
};

export const renderDocument = (
  value: DocumentProps["value"],
  components: MarkdownComponents,
): JSX.Element => (
  // oxlint-disable-next-line react/forbid-component-props -- Style the document root without changing Comark's native markup.
  <MarkdownDocument value={value} className="docs-markdown" components={components} />
);

export const localizedComponents = (locale: DocLocale): MarkdownComponents => ({
  ...defaultComponents,
  ProseA: createArticleLink(locale),
});
