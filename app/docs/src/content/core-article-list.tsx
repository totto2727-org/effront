import type { ReactNode } from "react";

type ArticleListItem = Readonly<{ content: ReactNode; id: string }>;

export const renderArticleList = (
  List: "ol" | "ul",
  items: Readonly<ArticleListItem[]>,
): ReactNode => (
  <List>
    {items.map(({ content, id }) => (
      <li key={id}>{content}</li>
    ))}
  </List>
);
