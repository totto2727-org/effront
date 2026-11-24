import type { DocPage } from "./types.ts";

export type ArticleMetadata = Readonly<Omit<DocPage, "content"> & { source: string }>;
