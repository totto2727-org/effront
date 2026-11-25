import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { CodeBlock } from "./code-block.tsx";
import type { CodeLanguage, CodeBlockProps } from "./code-block.tsx";
import { codeFixtures, serializedCodeText } from "./code-block-test.fixture.ts";

const render = (props: CodeBlockProps): string => renderToStaticMarkup(CodeBlock(props));

describe("source fidelity", () => {
  test.each(codeFixtures)("preserves exact source for the finite %s language", (language, code) => {
    const html = render({ code, language });
    expect(serializedCodeText(html)).toBe(code);
    expect(html).toContain('class="line"');
    expect(html).not.toContain("<script");
  });

  test.each([
    "",
    "\n",
    "\n\n",
    "no trailing newline",
    "\t leading and trailing \t ",
    "a\r\nb\r\n",
    "a\rb\rc",
    "a\r\nb\rc\n\n",
  ])("preserves serialized whitespace and line endings for %j", (code) => {
    // HTML parsers normalize literal carriage returns. Compare serialized source bytes.
    const html = render({ code, language: "tsx" });
    expect(serializedCodeText(html)).toBe(code);
  });

  test("escapes hostile markup as text instead of accepting HTML or event handlers", () => {
    const code =
      '</code></pre><script>globalThis.pwned = true</script><img src=x onerror="boom()"> &amp; \' "';
    const html = render({ code, language: "tsx" });
    expect(serializedCodeText(html)).toBe(code);
    const tags = [...html.matchAll(/<\/?(?<tag>[a-z][a-z0-9]*)\b/gu)].map(
      (match) => match.groups?.["tag"],
    );
    expect(new Set(tags)).toStrictEqual(new Set(["pre", "code", "span"]));
    expect(html).not.toMatch(/<[^>]+\bonerror\s*=/u);
  });
});

describe("language selection and grammar state", () => {
  test("uses explicit text mode by default and reports unsupported language wiring", () => {
    expect(render({ code: "plain" })).toContain('data-language="text"');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reproduce an invalid language supplied by an untyped JavaScript caller.
    const unknownLanguage = "not-registered" as CodeLanguage;
    expect(() => CodeBlock({ code: "unknown", language: unknownLanguage })).toThrow(
      "unsupported language",
    );
  });

  test("does not leak previous grammar state between repeated renders", () => {
    const code = "const number = 42;\n";
    const before = render({ code, language: "ts" });
    CodeBlock({ code: "/* unfinished comment", language: "ts" });
    expect(render({ code, language: "ts" })).toBe(before);
  });
});
