import { NodePath } from "@effect/platform-node-shared";
import { Array, Effect, Path, Predicate, Schema, String } from "effect";

import { MarkdownError } from "./error.ts";

export interface MarkdownCollectionOptions {
  /** Absolute public page prefix, for example `/manual`. */
  readonly basePath: string;
  /** Eager Vite `?raw` imports with keys relative to the glob `base`. */
  readonly documents: Readonly<Record<string, string>>;
  /** Eager Vite `?url` imports using the same glob `base`. Vite owns asset output. */
  readonly assets?: Readonly<Record<string, string>>;
}

export interface MarkdownEntry {
  /** Glob-base-relative source key, for example `./guides/start.md`. */
  readonly source: string;
  readonly content: string;
  readonly url: string;
  readonly pathname: string;
  resolveLink(href: string): Effect.Effect<string, MarkdownError>;
  resolveImage(source: string): Effect.Effect<string, MarkdownError>;
}

export interface MarkdownCollection {
  readonly entries: Readonly<MarkdownEntry[]>;
  get(pathname: string): MarkdownEntry | undefined;
  resolveLink(entry: MarkdownEntry, href: string): Effect.Effect<string, MarkdownError>;
  resolveImage(entry: MarkdownEntry, source: string): Effect.Effect<string, MarkdownError>;
}

const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
const missingSeparator = -1;
const splitReference = (reference: string): Readonly<[string, string]> => {
  const index = reference.search(/[?#]/u);
  return index === missingSeparator
    ? [reference, ""]
    : [String.takeLeft(reference, index), reference.slice(index)];
};
const segments = (path: string): string[] =>
  path.split("/").filter((part) => String.isNonEmpty(part) && part !== ".");
const encodedPathname = (parts: Readonly<string[]>): string =>
  `/${Array.map(parts, encodeURIComponent).join("/")}`;
const markdownExtension = /\.md$/iu;
const markdownExtensionLength = ".md".length;
const slashLength = "/".length;
const BasePath = Schema.String.check(Schema.isPattern(/^\/[^?#]*$/u));
const MarkdownFilename = Schema.String.check(
  Schema.isMinLength("a.md".length),
  Schema.isPattern(markdownExtension),
);
const isBasePath = Schema.is(BasePath);
const isMarkdownFilename = Schema.is(MarkdownFilename);

const importedSegments = (
  key: string,
  kind: "asset" | "document",
): Effect.Effect<Array.NonEmptyArray<string>, MarkdownError> => {
  const parts = segments(key);
  if (!key.startsWith("./") || !Array.isArrayNonEmpty(parts) || parts.includes("..")) {
    return Effect.fail(
      new MarkdownError({
        message: `${kind} glob key must be relative to the collection base: ${key}`,
      }),
    );
  }
  return Effect.succeed(parts);
};

const indexAssets = (
  assets: Readonly<Record<string, string>>,
): Effect.Effect<ReadonlyMap<string, string>, MarkdownError> =>
  Effect.forEach(Object.entries(assets), ([key, url]) =>
    importedSegments(key, "asset").pipe(
      Effect.map((parts) => [encodedPathname(parts), url] as const),
    ),
  ).pipe(Effect.map((entries) => new Map(entries)));

const isExternal = (reference: string): boolean =>
  reference.startsWith("#") || reference.startsWith("/") || /^[a-z][a-z\d+.-]*:/iu.test(reference);

// Encode each decoded URL segment before POSIX normalization so %2F stays a filename character.
const encodeReference = (path: string): string => {
  const decoded = Array.map(path.split("/"), decodeSegment);
  return Array.map(decoded, encodeURIComponent).join("/");
};
const isOutsideBase = (relative: string): boolean =>
  relative === ".." || relative.startsWith("../");

type ResolveReference = (
  entry: MarkdownEntry,
  reference: string,
  image: boolean,
) => Effect.Effect<string, MarkdownError>;

const referenceResolver =
  (
    paths: Path.Path,
    documents: ReadonlyMap<string, MarkdownEntry>,
    assets: ReadonlyMap<string, string>,
  ): ResolveReference =>
  (entry, reference, image) =>
    Effect.gen(function* () {
      // URL policy belongs to Comark and the application. Only file-relative references need mapping.
      if (isExternal(reference)) {
        return reference;
      }
      const [path, suffix] = splitReference(reference);
      if (String.isEmpty(path)) {
        return `${entry.url}${suffix}`;
      }
      const directory = paths.dirname(encodedPathname(segments(entry.source))).slice(slashLength);
      const relative = paths.join(directory, encodeReference(path));
      if (isOutsideBase(relative)) {
        return yield* new MarkdownError({
          message: `reference resolves outside the collection base: ${reference} from ${entry.source}`,
        });
      }
      const target = paths.resolve("/", relative);
      const isDocument = !image && markdownExtension.test(paths.basename(target));
      const url = isDocument ? documents.get(target)?.url : assets.get(target);
      if (Predicate.isNullish(url)) {
        const kind = isDocument ? "Markdown document" : "local asset";
        return yield* new MarkdownError({
          message: `reference does not name an imported ${kind}: ${reference} from ${entry.source}`,
        });
      }
      return `${url}${suffix}`;
    });

const documentUrl = (
  base: ReadonlyArray<string>,
  parts: Array.NonEmptyArray<string>,
  source: string,
): Effect.Effect<string, MarkdownError> => {
  const filename = Array.lastNonEmpty(parts);
  if (!isMarkdownFilename(filename)) {
    return Effect.fail(
      new MarkdownError({
        message: `document must have a filename ending in .md: ${source}`,
      }),
    );
  }
  const stem = String.takeLeft(filename, filename.length - markdownExtensionLength);
  const directories = Array.initNonEmpty(parts);
  return Effect.succeed(encodedPathname([...base, ...directories, stem]));
};

const findEntry = (
  entries: ReadonlyMap<string, MarkdownEntry>,
  pathname: string,
): MarkdownEntry | undefined => {
  const [path] = splitReference(pathname);
  if (!path.startsWith("/")) {
    return;
  }
  const withoutTrailingSlash = path.replace(/(?<last>[^/])\/$/u, "$<last>");
  const parts = withoutTrailingSlash.slice(slashLength).split("/");
  return entries.get(encodedPathname(Array.map(parts, decodeSegment)));
};

/**
 * Creates a collection from Vite's already-loaded document and asset maps.
 * @param {MarkdownCollectionOptions} options The public base path and Vite import maps.
 * @returns {Effect.Effect<MarkdownCollection, MarkdownError>} The indexed documents and resolvers.
 */
export const createMarkdownCollection = (
  options: MarkdownCollectionOptions,
): Effect.Effect<MarkdownCollection, MarkdownError> =>
  Effect.gen(function* () {
    const pathService = yield* Path.Path;
    const base = segments(options.basePath);
    if (!isBasePath(options.basePath) || base.includes("..")) {
      return yield* new MarkdownError({
        message: "basePath must be an absolute pathname without query, fragment, or traversal",
      });
    }
    const assets = yield* indexAssets(options.assets ?? {});
    const entriesByPathname = new Map<string, MarkdownEntry>();
    const entriesBySource = new Map<string, MarkdownEntry>();
    const resolve = referenceResolver(pathService, entriesBySource, assets);

    yield* Effect.forEach(
      Object.entries(options.documents),
      ([source, content]) =>
        Effect.gen(function* () {
          const parts = yield* importedSegments(source, "document");
          const url = yield* documentUrl(base, parts, source);
          if (entriesByPathname.has(url)) {
            return yield* new MarkdownError({
              message: `documents map to the same public pathname ${url}: ${source}`,
            });
          }
          const entry: MarkdownEntry = {
            content,
            pathname: url,
            resolveImage: (reference) => resolve(entry, reference, true),
            resolveLink: (reference) => resolve(entry, reference, false),
            source,
            url,
          };
          entriesBySource.set(encodedPathname(parts), entry);
          entriesByPathname.set(url, entry);
        }),
      { discard: true },
    );

    return {
      entries: [...entriesByPathname.values()].toSorted((left, right) =>
        left.url.localeCompare(right.url),
      ),
      get: (pathname) => findEntry(entriesByPathname, pathname),
      resolveImage: (entry, source) => resolve(entry, source, true),
      resolveLink: (entry, href) => resolve(entry, href, false),
    } satisfies MarkdownCollection;
  }).pipe(Effect.provide(NodePath.layerPosix));
