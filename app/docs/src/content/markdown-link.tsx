import type { ComponentProps, JSX } from "react";

import { localizeDocumentLink } from "./locale.ts";
import type { DocLocale } from "./locale.ts";

type LinkProps = ComponentProps<"a">;

export const createArticleLink = (locale: DocLocale): ((props: LinkProps) => JSX.Element) => {
  const ArticleLink = ({ children, href, ...props }: LinkProps): JSX.Element => (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Rewriting a destination preserves Comark's native anchor attributes and ref.
    <a {...props} href={localizeDocumentLink(href, locale)}>
      {children}
    </a>
  );
  return ArticleLink;
};
