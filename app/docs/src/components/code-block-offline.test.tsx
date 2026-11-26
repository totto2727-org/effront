import { Data } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vite-plus/test";
import type { MockInstance } from "vite-plus/test";

import { codeFixtures, serializedCodeText } from "./code-block-test.fixture.ts";

vi.mock(import("shiki/core"), async (importOriginal) => {
  const upstream = await importOriginal();
  return {
    ...upstream,
    createHighlighterCoreSync: vi.fn<typeof upstream.createHighlighterCoreSync>(
      upstream.createHighlighterCoreSync,
    ),
  };
});

class UnexpectedHighlightActivity extends Data.TaggedError("UnexpectedHighlightActivity")<{
  operation: string;
}> {}

type OfflineSpies = Readonly<{
  compileSpy: MockInstance<typeof WebAssembly.compile>;
  fetchSpy: MockInstance<typeof globalThis.fetch>;
  instantiateSpy: MockInstance<typeof WebAssembly.instantiate>;
}>;

const preventNetworkAndWasm = (): OfflineSpies => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new UnexpectedHighlightActivity({ operation: "network fetch" });
  });
  const instantiateSpy = vi.spyOn(WebAssembly, "instantiate").mockImplementation(() => {
    throw new UnexpectedHighlightActivity({ operation: "WebAssembly instantiation" });
  });
  const compileSpy = vi.spyOn(WebAssembly, "compile").mockImplementation(() => {
    throw new UnexpectedHighlightActivity({ operation: "WebAssembly compilation" });
  });
  return { compileSpy, fetchSpy, instantiateSpy };
};

type RenderEvidence = Readonly<{
  examples: string[];
  initializations: number;
  markup: string;
  startupInitializations: number;
}>;
type OfflineEvidence = RenderEvidence &
  Readonly<{ compile: number; fetch: number; instantiate: number }>;

const initialSource = 'const message = "日本語";\n';

const renderWithHighlighter = async (): Promise<RenderEvidence> => {
  const { CodeBlock } = await import("./code-block.tsx");
  const { createHighlighterCoreSync } = await import("shiki/core");
  const highlighter = vi.mocked(createHighlighterCoreSync);
  const startupInitializations = highlighter.mock.calls.length;
  const markup = renderToStaticMarkup(CodeBlock({ code: initialSource, language: "typescript" }));
  const examples = codeFixtures.map(([language, code]) => {
    const html = renderToStaticMarkup(CodeBlock({ code, language }));
    return serializedCodeText(html);
  });
  return {
    examples,
    initializations: highlighter.mock.calls.length,
    markup,
    startupInitializations,
  };
};

const captureOfflineRenders = async (): Promise<OfflineEvidence> => {
  vi.resetModules();
  const { compileSpy, fetchSpy, instantiateSpy } = preventNetworkAndWasm();
  try {
    const rendered = await renderWithHighlighter();
    return {
      ...rendered,
      compile: compileSpy.mock.calls.length,
      fetch: fetchSpy.mock.calls.length,
      instantiate: instantiateSpy.mock.calls.length,
    };
  } finally {
    compileSpy.mockRestore();
    fetchSpy.mockRestore();
    instantiateSpy.mockRestore();
  }
};

const testTokenColors = (html: string): number =>
  new Set(
    [...html.matchAll(/style="color:(?<color>#[\da-f]+)/giu)].map(
      (match) => match.groups?.["color"],
    ),
  ).size;

describe("server highlighter without network or WebAssembly", () => {
  test("initializes lazily once and preserves every registered grammar", async () => {
    const { examples, markup, ...observed } = await captureOfflineRenders();
    expect(observed).toStrictEqual({
      compile: 0,
      fetch: 0,
      initializations: 1,
      instantiate: 0,
      startupInitializations: 0,
    });
    expect(examples).toStrictEqual(codeFixtures.map(([, code]) => code));
    expect(serializedCodeText(markup)).toBe(initialSource);
    expect(
      [
        'class="shiki github-dark"',
        'data-code-block=""',
        'data-language="typescript"',
        'tabindex="0"',
        "background-color:#24292e",
        'class="line"',
      ].filter((attribute) => !markup.includes(attribute)),
    ).toStrictEqual([]);
    const plainTextColors = 1;
    expect(testTokenColors(markup)).toBeGreaterThan(plainTextColors);
  });
});
