import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function MarkdownPre({
  children,
  className,
  language,
}: ComponentProps<"pre"> & { language?: string }): JSX.Element {
  return (
    <pre
      className={className}
      data-code-block=""
      data-language={language ?? "text"}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keep native horizontal scrolling reachable by keyboard.
      tabIndex={0}
    >
      {children}
    </pre>
  );
}
