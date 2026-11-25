import type { JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function ServerMermaid({ content }: Readonly<{ content: string }>): JSX.Element {
  return <pre data-testid="server-mermaid">Server diagram: {content}</pre>;
}
