import { Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert } from "lucide-react";
import type { JSX, ReactNode } from "react";

const alerts = {
  caution: { Icon: OctagonAlert, title: "Caution" },
  important: { Icon: MessageSquareWarning, title: "Important" },
  note: { Icon: Info, title: "Note" },
  tip: { Icon: Lightbulb, title: "Tip" },
  warning: { Icon: TriangleAlert, title: "Warning" },
};

export type AlertKind = keyof typeof alerts;
export type AlertContent = Readonly<{ children?: ReactNode }>;
type AlertProps = AlertContent & Readonly<{ kind: AlertKind }>;

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function MarkdownAlert({ children, kind }: AlertProps): JSX.Element {
  const { title, Icon } = alerts[kind];
  return (
    <aside className="docs-alert" data-alert={kind} aria-label={title}>
      <p className="docs-alert-title">
        <Icon size={16} aria-hidden="true" />
        {title}
      </p>
      <div className="docs-alert-body">{children}</div>
    </aside>
  );
}
