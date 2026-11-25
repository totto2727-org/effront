import { manual } from "#fixture/content.ts";
import { parseMarkdown } from "@effront/markdown";
import { MarkdownDocument } from "@effront/markdown/document";
import { Math } from "@effront/markdown/math";
import { Mermaid } from "@effront/markdown/mermaid";
import { Data, Effect, Predicate } from "effect";
import { EFFRONT } from "./effront.ts";
import { ServerMath } from "./server-math.tsx";
import { ServerMermaid } from "./server-mermaid.tsx";

class MissingManualContent extends Data.TaggedError("MissingManualContent") {}

const serverRenderers = { Math: ServerMath, Mermaid: ServerMermaid };
const lightTheme = { bg: "#ffffff", fg: "#123456" };
const darkTheme = { bg: "#112233", fg: "#abcdef" };
// oxlint-disable-next-line react/forbid-component-props -- This fixture verifies the Markdown Math component's public className option.
const math = <Math className="inline" content="x^2" />;
// oxlint-disable react/forbid-component-props -- This diagram verifies the Mermaid component's public className option.
const diagram = (
  <Mermaid
    className="custom-mermaid"
    content={"flowchart LR\n Public --> API"}
    height="180px"
    theme={lightTheme}
    themeDark={darkTheme}
    width="320px"
  />
);
// oxlint-enable react/forbid-component-props

export const ServerOverridesPage = EFFRONT.Page.make({
  render: Effect.fn("ServerOverridesPage.render")(function* () {
    const collection = yield* manual;
    const entry = collection.get("/manual");
    if (Predicate.isNullish(entry)) {
      return yield* Effect.die(new MissingManualContent());
    }
    const document = yield* parseMarkdown(entry);
    return (
      <article data-testid="server-only-markdown">
        <MarkdownDocument value={document} components={serverRenderers} />
      </article>
    );
  }),
});

export const RichComponentsPage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <article data-testid="public-rich-components">
        {math}
        {diagram}
      </article>,
    ),
});
