import type { MarkdownEntry } from "@effront/markdown";
import { Cache, Duration, Effect, Exit } from "effect";

const cacheCapacity = 128;

/**
 * Reuses a successfully parsed document while its Vite-loaded source and parser
 * settings remain unchanged. The route URL distinguishes collections whose
 * relative links resolve differently, such as the English and Japanese docs.
 */
export function createMarkdownDocumentCache<Document, Failure>(
  parse: (entry: MarkdownEntry) => Effect.Effect<Document, Failure>,
) {
  const cache = Effect.runSync(
    Cache.makeWith<MarkdownEntry, Document, Failure>(parse, {
      capacity: cacheCapacity,
      // Cache shares in-progress lookups. Retain only successful parses so a
      // corrected document is retried immediately without a module reload.
      timeToLive: (exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
    }),
  );

  return (entry: MarkdownEntry): Effect.Effect<Document, Failure> => Cache.get(cache, entry);
}
