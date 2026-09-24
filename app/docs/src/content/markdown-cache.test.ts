import type { MarkdownEntry } from "@effront/markdown";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { createMarkdownDocumentCache } from "./markdown-cache";

const entry = (url: string, content: string): MarkdownEntry => ({
  source: `.${url}.md`,
  content,
  url,
  pathname: url,
  resolveLink: (href) => Effect.succeed(href),
  resolveImage: (source) => Effect.succeed(source),
});

describe("createMarkdownDocumentCache", () => {
  it("reuses a parsed document on repeated rendering of an unchanged article", async () => {
    const parse = vi.fn((document: MarkdownEntry) => Effect.succeed({ content: document.content }));
    const parseCached = createMarkdownDocumentCache(parse);
    const article = entry("/guide/routes", "# Routes");

    await expect(Effect.runPromise(parseCached(article))).resolves.toEqual({ content: "# Routes" });
    await expect(Effect.runPromise(parseCached(article))).resolves.toEqual({ content: "# Routes" });

    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("shares an in-progress parse between concurrent document renders", async () => {
    const parse = vi.fn((document: MarkdownEntry) =>
      Effect.sleep("10 millis").pipe(Effect.as(document.content)),
    );
    const parseCached = createMarkdownDocumentCache(parse);
    const article = entry("/guide/routes", "# Routes");

    await expect(
      Effect.runPromise(
        Effect.all([parseCached(article), parseCached(article)], { concurrency: "unbounded" }),
      ),
    ).resolves.toEqual(["# Routes", "# Routes"]);

    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("does not share documents between locales with independently resolved URLs", async () => {
    const parse = vi.fn((document: MarkdownEntry) => Effect.succeed(document.url));
    const parseCached = createMarkdownDocumentCache(parse);

    await expect(Effect.runPromise(parseCached(entry("/guide/routes", "# Routes")))).resolves.toBe(
      "/guide/routes",
    );
    await expect(
      Effect.runPromise(parseCached(entry("/en/guide/routes", "# Routes"))),
    ).resolves.toBe("/en/guide/routes");

    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("invalidates a document when Vite supplies fresh source content", async () => {
    const parse = vi.fn((document: MarkdownEntry) => Effect.succeed(document.content));
    const parseCached = createMarkdownDocumentCache(parse);

    await expect(Effect.runPromise(parseCached(entry("/guide/routes", "# First")))).resolves.toBe(
      "# First",
    );
    await expect(Effect.runPromise(parseCached(entry("/guide/routes", "# Updated")))).resolves.toBe(
      "# Updated",
    );

    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("does not retain failed parses", async () => {
    const failure = new Error("invalid Markdown");
    const parse = vi
      .fn<(document: MarkdownEntry) => Effect.Effect<string, Error>>()
      .mockReturnValueOnce(Effect.fail(failure))
      .mockImplementation((document) => Effect.succeed(document.content));
    const parseCached = createMarkdownDocumentCache(parse);
    const article = entry("/guide/routes", "# Routes");

    await expect(Effect.runPromise(parseCached(article))).rejects.toBe(failure);
    await expect(Effect.runPromise(parseCached(article))).resolves.toBe("# Routes");

    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("starts with an empty cache for a fresh module instance", async () => {
    const parse = vi.fn((document: MarkdownEntry) => Effect.succeed(document.content));
    const article = entry("/guide/routes", "# Routes");

    await Effect.runPromise(createMarkdownDocumentCache(parse)(article));
    await Effect.runPromise(createMarkdownDocumentCache(parse)(article));

    expect(parse).toHaveBeenCalledTimes(2);
  });
});
