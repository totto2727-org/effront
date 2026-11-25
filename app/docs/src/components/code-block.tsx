import { Function, Predicate } from "effect";
import { Fragment } from "react";
import type { CSSProperties, JSX } from "react";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";
import type { ThemedToken, TokenStyles } from "shiki/types";

import { codeBlockGrammars } from "./code-block-grammars.ts";

// RSC content modules own the highlighter and its JavaScript engine.
const highlighterOptions = {
  engine: createJavaScriptRegexEngine(),
  langs: codeBlockGrammars,
  themes: [githubDark],
};

const languages = {
  bash: "bash",
  css: "css",
  diff: "diff",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  jsonc: "jsonc",
  jsx: "jsx",
  sh: "bash",
  shell: "bash",
  text: "text",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
} as const;

export type CodeLanguage = keyof typeof languages;

export type CodeBlockProps = Readonly<{
  code: string;
  language?: CodeLanguage;
}>;

const firstSourceOffset = 0;
const noFontStyle = 0;
const italicFontStyle = 1;
const boldFontStyle = 2;
const underlineFontStyle = 4;

const hasFontStyle = (font: number, flag: number): boolean =>
  // oxlint-disable-next-line eslint/no-bitwise -- TextMate supplies combined font styles as bit flags.
  (font & flag) !== noFontStyle;

const highlighting = Function.memoize((options: typeof highlighterOptions) => {
  // oxlint-disable-next-line node/no-sync -- The shared server component also renders through React's synchronous static renderer.
  const highlighter = createHighlighterCoreSync(options);
  const theme = highlighter.getTheme("github-dark");
  const rootStyle: CSSProperties = { backgroundColor: theme.bg, color: theme.fg };
  return { foreground: theme.fg, highlighter, rootStyle };
});

const tokenStyle = (token: TokenStyles, foreground: CSSProperties["color"]): CSSProperties => {
  const flags = token.fontStyle ?? noFontStyle;
  return {
    color: token.color ?? foreground,
    ...(Predicate.isNullish(token.bgColor) ? {} : { backgroundColor: token.bgColor }),
    ...(hasFontStyle(flags, italicFontStyle) ? { fontStyle: "italic" } : {}),
    ...(hasFontStyle(flags, boldFontStyle) ? { fontWeight: "bold" } : {}),
    ...(hasFontStyle(flags, underlineFontStyle) ? { textDecoration: "underline" } : {}),
  };
};

type CodeLine = Readonly<{ ending: string; offset: number; tokens: ThemedToken[] }>;

const sourceLines = (code: string, highlighted: ThemedToken[][]): CodeLine[] => {
  // Shiki drops line delimiters. Restore the original bytes after each rendered line.
  const endings = [...code.matchAll(/\r?\n/gu)];
  const offsets = [
    firstSourceOffset,
    ...endings.map((match) => {
      const [ending] = match;
      return match.index + ending.length;
    }),
  ];
  return highlighted.map((tokens, index) => ({
    ending: endings[index]?.[0] ?? "",
    offset: offsets[index] ?? code.length,
    tokens,
  }));
};

const renderToken = (token: ThemedToken, foreground: CSSProperties["color"]): JSX.Element => (
  <span key={token.offset} style={tokenStyle(token, foreground)}>
    {token.content}
  </span>
);

const renderCodeLine = (
  { ending, offset, tokens }: CodeLine,
  foreground: CSSProperties["color"],
): JSX.Element => (
  <Fragment key={offset}>
    <span className="line">{tokens.map((token) => renderToken(token, foreground))}</span>
    {ending}
  </Fragment>
);

const renderCode = (lines: CodeLine[], foreground: CSSProperties["color"]): JSX.Element => (
  <code>{lines.map((line) => renderCodeLine(line, foreground))}</code>
);

// Server-rendered tokens stay text nodes, including HTML-looking source excerpts.
// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function CodeBlock({ code, language = "text" }: CodeBlockProps): JSX.Element {
  if (!Object.hasOwn(languages, language)) {
    // oxlint-disable-next-line rules/require-tagged-error -- Invalid JavaScript callers receive the synchronous TypeError contract.
    throw new TypeError("CodeBlock received an unsupported language.");
  }
  const lang = languages[language];
  const { foreground, highlighter, rootStyle } = highlighting(highlighterOptions);
  const tokens = highlighter.codeToTokensBase(code, { lang, theme: "github-dark" });

  return (
    <pre
      className="shiki github-dark"
      data-code-block=""
      data-language={lang}
      style={rootStyle}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Give keyboard users access to the native horizontally scrollable code.
      tabIndex={0}
    >
      {renderCode(sourceLines(code, tokens), foreground)}
    </pre>
  );
}
