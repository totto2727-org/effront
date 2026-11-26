import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  basePath: "/",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./content",
    eager: true,
    import: "default",
    query: "?raw",
  }),
});
