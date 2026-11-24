import type { ComponentProps } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { afterAll, beforeAll, describe, expect, test, vi } from "vite-plus/test";
import { Math } from "@effront/markdown/math";
import { Math as ComarkMath } from "@comark/react/components/Math";

type MermaidProps = ComponentProps<typeof import("@comark/react/components/Mermaid").Mermaid>;

const { upstreamMermaid, ready } = vi.hoisted(() => ({
  upstreamMermaid: vi.fn<(props: MermaidProps) => null>(() => null),
  ready: Promise.resolve(),
}));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  browser: () => ready,
}));
vi.mock("@comark/react/components/Mermaid", () => ({ Mermaid: upstreamMermaid }));
describe("public rich components", () => {
  beforeAll(() => vi.stubEnv("SSR", false));
  afterAll(() => vi.unstubAllEnvs());

  test("exports Math as the unchanged upstream component", () => {
    expect(Math).toBe(ComarkMath);
  });

  test.each([
    { content: "flowchart LR\n A --> B" },
    {
      content: "flowchart LR\n A --> B",
      className: "diagram",
      height: "12rem",
      width: "80%",
      theme: { bg: "#ffffff", fg: "#000000" },
      themeDark: { bg: "#000000", fg: "#ffffff" },
    },
    { content: "flowchart LR\n A --> B", "theme-dark": "github-dark" },
    {
      content: "flowchart LR\n A --> B",
      themeDark: "tokyo-night",
      "theme-dark": "github-dark",
    },
  ] satisfies (MermaidProps & { "theme-dark"?: string })[])(
    "forwards upstream props unchanged: %j",
    async (props) => {
      const { Mermaid } = await import("@effront/markdown/mermaid");
      upstreamMermaid.mockClear();
      const stream = await renderToReadableStream(<Mermaid {...props} />);
      await new Response(stream).text();
      expect(upstreamMermaid).toHaveBeenCalled();
      expect(upstreamMermaid.mock.lastCall?.[0]).toStrictEqual(props);
    },
  );
});
