import type { JSX } from "react";

export const ServerMath = ({ content }: Readonly<{ content: string }>): JSX.Element => (
  <span data-testid="server-math">Server math: {content}</span>
);
