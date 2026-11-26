import type { JSX } from "react";

export const ServerMermaid = ({ content }: Readonly<{ content: string }>): JSX.Element => (
  <pre data-testid="server-mermaid">Server diagram: {content}</pre>
);
