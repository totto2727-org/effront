import { expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { Data, Schema } from "effect";

import { docsTest as test } from "./docs-host.fixture.ts";

const httpStatusOk = 200;
const minimumModuleCount = 10;
const richRendererCount = 2;
const mermaidWrappers = 1;
const ClientGraph = Schema.Struct({ modules: Schema.Array(Schema.String) });
const isClientGraph = Schema.is(ClientGraph);

class InvalidClientGraph extends Data.TaggedError("InvalidClientGraph")<{ message: string }> {}

const readModules = async (request: APIRequestContext): Promise<Readonly<string[]>> => {
  const response = await request.get("/acceptance-client-graph.json");
  expect(response.status()).toBe(httpStatusOk);
  const graph: unknown = await response.json();
  if (!isClientGraph(graph)) {
    throw new InvalidClientGraph({ message: "Expected built browser module IDs" });
  }
  return graph.modules;
};

const requiredModules = [
  {
    count: richRendererCount,
    label: "Configured KaTeX and Mermaid runtime implementations are present in the browser build",
    pattern: /(?:^|\/)node_modules\/(?:katex|beautiful-mermaid)\//u,
  },
  {
    count: mermaidWrappers,
    label: "The Mermaid client wrapper is isolated while the Math re-export is optimized away",
    pattern: /packages\/markdown\/(?:src|dist)\/(?:math|mermaid)\.[jt]sx?/u,
  },
  {
    count: richRendererCount,
    label: "Configured upstream Math and Mermaid leaves are present in the browser build",
    pattern: /(?:^|\/)node_modules\/@comark\/react\/dist\/components\/(?:Math|Mermaid)\.js/u,
  },
];

const serverOnlyModules = [
  {
    label: "The parsed document renderer remains in the RSC graph",
    pattern: /packages\/markdown\/(?:src|dist)\/(?:document|index|parse)\.[jt]sx?/u,
  },
  {
    label: "Comark's document renderer is not clientified",
    pattern:
      /(?:^|\/)node_modules\/@comark\/react\/(?:dist\/(?:index|components\/MarkdownDocument)|index)/u,
  },
  {
    label: "No browser Markdown parser or syntax-highlighting implementation",
    pattern:
      /(?:^|\/)node_modules\/(?:comark|shiki|oniguruma|vscode-textmate|markdown-it|micromark)\//u,
  },
];

test("keeps Markdown parsing and Shiki out of the actual browser build while including renderers", async ({
  request,
}) => {
  const modules = await readModules(request);
  expect(modules.length, "Audit a real nonempty client build").toBeGreaterThan(minimumModuleCount);
  expect(modules.some((id) => id.includes("/e2e-build/fixture/src/"))).toBe(true);
  requiredModules.forEach(({ count, label, pattern }) => {
    expect(
      modules.filter((id) => pattern.test(id)),
      label,
    ).toHaveLength(count);
  });
  serverOnlyModules.forEach(({ label, pattern }) => {
    expect(
      modules.filter((id) => pattern.test(id)),
      label,
    ).toEqual([]);
  });
});
