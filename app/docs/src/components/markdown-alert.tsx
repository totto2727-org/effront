import type { ReactNode } from "react";
import { MarkdownAlertIcon } from "./markdown-alert-icon";

const alerts = {
  note: { title: "Note", icon: "info" },
  tip: { title: "Tip", icon: "lightbulb" },
  important: { title: "Important", icon: "message-square-warning" },
  warning: { title: "Warning", icon: "triangle-alert" },
  caution: { title: "Caution", icon: "octagon-alert" },
} as const;

function alertComponent(type: keyof typeof alerts) {
  const { title, icon } = alerts[type];
  return function MarkdownAlert({ children }: { children?: ReactNode }) {
    return (
      <aside className="docs-alert" data-alert={type} aria-label={title}>
        <p className="docs-alert-title">
          <MarkdownAlertIcon name={icon} />
          {title}
        </p>
        <div className="docs-alert-body">{children}</div>
      </aside>
    );
  };
}

// Comark's default alert plugin resolves its `as` attribute through this map.
export const markdownAlertComponents = {
  note: alertComponent("note"),
  tip: alertComponent("tip"),
  important: alertComponent("important"),
  warning: alertComponent("warning"),
  caution: alertComponent("caution"),
};
