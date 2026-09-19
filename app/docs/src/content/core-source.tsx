import { CodeBlock, type CodeLanguage } from "../components/code-block";

export interface CoreSource {
  readonly path: string;
  readonly code: string;
  readonly language: CodeLanguage;
}

export function SourceExcerpt({
  source,
  locale = "ja",
}: {
  readonly source: CoreSource;
  readonly locale?: "en" | "ja";
}) {
  return (
    <figure data-core-source={source.path}>
      <figcaption>
        {locale === "en" ? (
          <>
            Excerpt from <code>{source.path}</code>
          </>
        ) : (
          <>
            <code>{source.path}</code> の抜粋
          </>
        )}
      </figcaption>
      <CodeBlock code={source.code} language={source.language} />
    </figure>
  );
}
