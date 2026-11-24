import type { ArticleMetadata } from "#docs/content/article-metadata.ts";

import { guideArticles } from "./catalog-guides.ts";
import { onboardingArticles } from "./catalog-onboarding.ts";
import { referenceArticles } from "./catalog-reference.ts";

// Stable routes, navigation order, and heading IDs are independent of Markdown file names.
export const articleCatalog = [
  ...onboardingArticles,
  ...guideArticles,
  ...referenceArticles,
] as const satisfies Readonly<ArticleMetadata[]>;
