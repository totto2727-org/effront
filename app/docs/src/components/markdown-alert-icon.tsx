"use client";

import { Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert } from "lucide-react";

const icons = {
  info: Info,
  lightbulb: Lightbulb,
  "message-square-warning": MessageSquareWarning,
  "triangle-alert": TriangleAlert,
  "octagon-alert": OctagonAlert,
} as const;

export function MarkdownAlertIcon({ name }: { name: keyof typeof icons }) {
  const Icon = icons[name];
  return <Icon size={16} aria-hidden="true" />;
}
