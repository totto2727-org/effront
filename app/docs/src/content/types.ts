import type { MarkdownError, MarkdownParseError } from "@effront/markdown";
import type { Effect } from "effect";
import type { ReactNode } from "react";

export interface DocPage {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly section:
    | "Getting started"
    | "Platforms"
    | "Guides"
    | "Best practices"
    | "API reference"
    | "アーキテクチャ"
    | "Architecture";
  readonly group?: string;
  readonly headings: Readonly<Readonly<{ id: string; title: string }>[]>;
  readonly content: () => ReactNode;
}

export interface RenderableDocPage extends Omit<DocPage, "content"> {
  readonly content: () => Effect.Effect<ReactNode, MarkdownError | MarkdownParseError>;
}
