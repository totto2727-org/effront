import type { ReactNode } from "react";
import { Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert } from "lucide-react";

const alerts = {
  note: { title: "Note", Icon: Info },
  tip: { title: "Tip", Icon: Lightbulb },
  important: { title: "Important", Icon: MessageSquareWarning },
  warning: { title: "Warning", Icon: TriangleAlert },
  caution: { title: "Caution", Icon: OctagonAlert },
} as const;

function alertComponent(type: keyof typeof alerts) {
  const { title, Icon } = alerts[type];
  return function MarkdownAlert({ children }: { children?: ReactNode }) {
    return (
      <aside className="docs-alert" data-alert={type} aria-label={title}>
        <p className="docs-alert-title">
          <Icon size={16} aria-hidden="true" />
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
