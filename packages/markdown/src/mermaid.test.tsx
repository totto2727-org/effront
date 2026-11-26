import { Math } from "@effront/markdown/math";
import { Math as ComarkMath } from "@comark/react/components/Math";
import type { MermaidProps } from "@comark/react/components/Mermaid";
import { createElement } from "react";
import type { ReactElement } from "react";
import type * as ReactDOM from "react-dom";
import { renderToReadableStream } from "react-dom/server.edge";
import { afterAll, beforeAll, describe, expect, test, vi } from "vite-plus/test";

const { ready, upstreamMermaid } = vi.hoisted(() => ({
  ready: Promise.resolve(),
  upstreamMermaid: vi.fn<(props: MermaidProps) => ReactElement>(() => <output />),
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The SSR fixture replaces React's opaque browser token with a resolved thenable.
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactDOM>()),
  // oxlint-disable-next-line typescript/promise-function-async -- Suspense must receive the same browser-readiness Promise on each render.
  browser: (): Promise<void> => ready,
}));
vi.mock(import("@comark/react/components/Mermaid"), () => ({ Mermaid: upstreamMermaid }));

describe("public rich components", () => {
  beforeAll(() => {
    vi.stubEnv("SSR", false);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  test("exports Math as the unchanged upstream component", () => {
    expect(Math).toBe(ComarkMath);
  });

  test.each([
    { content: "flowchart LR\n A --> B" },
    {
      className: "diagram",
      content: "flowchart LR\n A --> B",
      height: "12rem",
      theme: { bg: "#ffffff", fg: "#000000" },
      themeDark: { bg: "#000000", fg: "#ffffff" },
      width: "80%",
    },
    { content: "flowchart LR\n A --> B", "theme-dark": "github-dark" },
    {
      content: "flowchart LR\n A --> B",
      "theme-dark": "github-dark",
      themeDark: "tokyo-night",
    },
  ] satisfies (MermaidProps & { "theme-dark"?: string })[])(
    "forwards upstream props unchanged: %j",
    async (props) => {
      const { Mermaid } = await import("@effront/markdown/mermaid");
      upstreamMermaid.mockClear();
      const stream = await renderToReadableStream(createElement(Mermaid, props));
      await new Response(stream).text();
      expect(upstreamMermaid.mock.lastCall?.[0]).toStrictEqual(props);
    },
  );
});
