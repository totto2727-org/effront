import type { ReactNode } from "react";

import { CodeBlock } from "#docs/components/code-block.tsx";
import type { CodeLanguage } from "#docs/components/code-block.tsx";

export type CoreSource = Readonly<{
  code: string;
  language: CodeLanguage;
  path: string;
}>;

type ExcerptLocale = "en" | "ja";

const renderCaption = (locale: ExcerptLocale, path: string): ReactNode =>
  locale === "en" ? (
    <figcaption>
      Excerpt from <code>{path}</code>
    </figcaption>
  ) : (
    <figcaption>
      <code>{path}</code> の抜粋
    </figcaption>
  );

export const SourceExcerpt = ({
  source,
  locale = "ja",
}: Readonly<{
  source: CoreSource;
  locale?: ExcerptLocale;
}>): ReactNode => (
  <figure data-core-source={source.path}>
    {renderCaption(locale, source.path)}
    <CodeBlock code={source.code} language={source.language} />
  </figure>
);
