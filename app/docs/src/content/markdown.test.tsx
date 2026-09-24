import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { RenderableDocPage } from "./types";

const parse = vi.hoisted(() => vi.fn());

vi.mock("@effront/markdown", async (importOriginal) => {
  const original = await importOriginal<typeof import("@effront/markdown")>();
  parse.mockImplementation(original.parseMarkdown);
  return { ...original, parseMarkdown: parse };
});

import { localizedMarkdownPages, markdownPages } from "./markdown";

const page = (pages: readonly RenderableDocPage[], slug: string) => {
  const candidate = pages.find((candidate) => candidate.slug === slug);
  if (!candidate) throw new TypeError(`Test documentation page is missing: ${slug}`);
  return candidate;
};

describe("documentation Markdown collection reuse", () => {
  beforeEach(() => {
    parse.mockClear();
  });

  it("reuses the parsed document across repeated legacy and localized page content calls", async () => {
    const legacy = page(markdownPages, "/guide/routes");
    await Effect.runPromise(legacy.content());
    await Effect.runPromise(legacy.content());
    expect(parse).toHaveBeenCalledTimes(1);

    parse.mockClear();
    const english = page(localizedMarkdownPages("en"), "/en/guide/routes");
    await Effect.runPromise(english.content());
    await Effect.runPromise(english.content());
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
