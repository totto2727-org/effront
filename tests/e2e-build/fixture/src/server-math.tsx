import type { JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function ServerMath({ content }: Readonly<{ content: string }>): JSX.Element {
  return <span data-testid="server-math">Server math: {content}</span>;
}
