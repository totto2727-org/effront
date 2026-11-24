import type { MarkdownError, MarkdownParseError } from "@effront/markdown";
import type { Effect } from "effect";
import type { ReactNode } from "react";

export type DocPage = Readonly<{
  content: () => ReactNode;
  description: string;
  group?: string;
  headings: Readonly<Readonly<{ id: string; title: string }>[]>;
  section:
    | "Getting started"
    | "Platforms"
    | "Guides"
    | "Best practices"
    | "API reference"
    | "アーキテクチャ"
    | "Architecture";
  slug: string;
  title: string;
}>;

export type RenderableDocPage = Omit<DocPage, "content"> &
  Readonly<{ content: () => Effect.Effect<ReactNode, MarkdownError | MarkdownParseError> }>;
