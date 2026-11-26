import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  assets: import.meta.glob<string>("./**/*.{svg,png,jpg,jpeg,gif,webp,pdf}", {
    base: "./content",
    eager: true,
    import: "default",
    query: "?url&no-inline",
  }),
  basePath: "/",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./content",
    eager: true,
    import: "default",
    query: "?raw",
  }),
});
