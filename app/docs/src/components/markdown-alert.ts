import { createElement } from "react";
import type { ReactElement } from "react";

import { MarkdownAlert } from "./markdown-alert-view.tsx";
import type { AlertContent, AlertKind } from "./markdown-alert-view.tsx";

const alertComponent =
  (kind: AlertKind): ((props: AlertContent) => ReactElement) =>
  function AlertCallout({ children }: AlertContent): ReactElement {
    return createElement(MarkdownAlert, { kind }, children);
  };

// Comark's default alert plugin resolves its as attribute through this map.
export const markdownAlertComponents = {
  caution: alertComponent("caution"),
  important: alertComponent("important"),
  note: alertComponent("note"),
  tip: alertComponent("tip"),
  warning: alertComponent("warning"),
};
