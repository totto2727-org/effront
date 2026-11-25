import { Array, Data, Predicate, Schema, String } from "effect";

export type AbsolutePath = `/${string}`;

// Compile-time and runtime route grammars are deliberately paired. Any grammar change must update
// Update the type validators and analyzeRoutePath together, with paired type and runtime checks.
type InvalidRouteCharacter = "?" | "#" | "%" | ";" | "\\";
type InvalidParameterCharacter = InvalidRouteCharacter | "*" | "/" | ":" | "(" | ")" | "." | "-";

export type ValidRouteParamName<Name extends string> = string extends Name
  ? never
  : Name extends ""
    ? never
    : Name extends `${string}${InvalidParameterCharacter}${string}`
      ? never
      : Name;

type IsUnion<Value, Whole = Value> = Value extends Whole
  ? [Whole] extends [Value]
    ? false
    : true
  : never;

type ValidRouteSegments<
  Segments extends string,
  Seen extends string = never,
> = string extends Segments
  ? false
  : Segments extends `${infer Segment}/${infer Rest}`
    ? Segment extends "" | "." | ".."
      ? false
      : Segment extends `:${infer Parameter}`
        ? Parameter extends ""
          ? false
          : Parameter extends `${string}${InvalidParameterCharacter}${string}`
            ? false
            : Parameter extends Seen
              ? false
              : ValidRouteSegments<Rest, Seen | Parameter>
        : Segment extends `${string}${":" | "*"}${string}`
          ? false
          : ValidRouteSegments<Rest, Seen>
    : Segments extends "" | "." | ".."
      ? false
      : Segments extends `${":" | "*"}${infer Parameter}`
        ? Parameter extends ""
          ? false
          : Parameter extends `${string}${InvalidParameterCharacter}${string}`
            ? false
            : Parameter extends Seen
              ? false
              : true
        : Segments extends `${string}${":" | "*"}${string}`
          ? false
          : true;

export type ValidRoutePath<Path extends AbsolutePath> =
  true extends IsUnion<Path>
    ? never
    : Path extends "/"
      ? Path
      : Path extends `${string}${InvalidRouteCharacter}${string}`
        ? never
        : Path extends `/${infer Segments}`
          ? ValidRouteSegments<Segments> extends true
            ? Path
            : never
          : never;

type RouteParamNamesFromSegments<Segments extends string> =
  Segments extends `${infer Segment}/${infer Rest}`
    ?
        | (Segment extends `:${infer Parameter}` ? Parameter : never)
        | RouteParamNamesFromSegments<Rest>
    : Segments extends `${":" | "*"}${infer Parameter}`
      ? Parameter
      : never;

export type RouteParamNames<Path extends AbsolutePath> = Path extends `/${infer Segments}`
  ? RouteParamNamesFromSegments<Segments>
  : never;

type RouteShapeSegments<Segments extends string> = Segments extends `${infer Segment}/${infer Rest}`
  ? `${Segment extends `:${string}` ? ":" : Segment}/${RouteShapeSegments<Rest>}`
  : Segments extends `:${string}`
    ? ":"
    : Segments extends `*${string}`
      ? "*"
      : Segments;

type MatcherShape<Path extends AbsolutePath> = Path extends `/${infer Segments}`
  ? Lowercase<`/${RouteShapeSegments<Segments>}`>
  : never;

// Effect HttpRouter also registers the prefix of a wildcard as its empty-capture route.
export type RouteShape<Path extends AbsolutePath> =
  Path extends `${infer Prefix extends AbsolutePath}/*${string}`
    ? MatcherShape<Path> | MatcherShape<Prefix>
    : Path extends `/*${string}`
      ? MatcherShape<Path> | "/"
      : MatcherShape<Path>;

export type JoinPath<Prefix extends AbsolutePath, Path extends AbsolutePath> = Prefix extends "/"
  ? Path
  : Path extends "/"
    ? Prefix
    : `${Prefix}${Path}`;

export const FrameworkNamespace = "/_effront";

export const FrameworkAssetNamespace = `${FrameworkNamespace}/assets`;

export const FrameworkAssetPrefix = `${FrameworkAssetNamespace}/` as const;

type SegmentCanMatch<
  Segment extends string,
  Expected extends string,
> = Segment extends `${":" | "*"}${string}`
  ? true
  : Lowercase<Segment> extends Expected
    ? true
    : false;

type MatchesReservedSegments<Segments extends string> = Segments extends `${infer First}/${string}`
  ? SegmentCanMatch<First, "_effront">
  : SegmentCanMatch<Segments, "_effront">;

export type ReservedRoutePath<Path extends AbsolutePath> = Path extends `/${infer Segments}`
  ? MatchesReservedSegments<Segments> extends true
    ? Path
    : never
  : never;

const InvalidRoutePath = /[?#%;\\]/u;
const DynamicSegment = /^[:*](?<name>[^:*().-]+)$/u;
const rootPath = "/";
const firstCharacter = 0;
const afterLeadingSlash = 1;
const lastSegment = -1;
const catchAllSuffix = "/*";
const absolutePath = Schema.TemplateLiteral([rootPath, Schema.String]);

export const isAbsolutePath = Schema.is(absolutePath);

type RoutePattern = Readonly<{
  catchAll: string | null;
  matcher: AbsolutePath;
  shape: string;
  shapes: Readonly<string[]>;
}>;

type RouteAnalysis = Data.TaggedEnum<{
  ParameterFree: RoutePattern;
  Parameterized: RoutePattern & Readonly<{ parameterNames: Readonly<[string, ...string[]]> }>;
}>;

const routeAnalyses = Data.taggedEnum<RouteAnalysis>();

const routePathError = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- The public route authoring API throws TypeError for invalid paths.
  new TypeError(message);

const splitRoute = (path: string): string[] => {
  if (!path.startsWith(rootPath) || InvalidRoutePath.test(path)) {
    throw routePathError(
      `Invalid route path "${path}". Route paths must start with "/" and cannot contain "?", "#", "%", ";", or "\\".`,
    );
  }
  const segments = path === rootPath ? [] : path.slice(afterLeadingSlash).split(rootPath);
  if (segments.some((segment) => String.isEmpty(segment) || segment === "." || segment === "..")) {
    throw routePathError(
      `Invalid route path "${path}". Route paths cannot contain empty, ".", or ".." segments or end with "/".`,
    );
  }
  return segments;
};

const dynamicParameter = (path: string, segment: string, terminal: boolean): string => {
  const match = DynamicSegment.exec(segment);
  if (segment.includes("*") && (Predicate.isNullish(match) || !terminal)) {
    throw routePathError(
      `Invalid route path "${path}". Catch-all segments must use the terminal "*parameter" convention.`,
    );
  }
  if (Predicate.isNullish(match)) {
    throw routePathError(
      `Invalid route path "${path}". Dynamic segments must use the ":parameter" convention.`,
    );
  }
  const [, name] = match;
  if (Predicate.isNullish(name)) {
    throw routePathError(
      `Invalid route path "${path}". Dynamic parameter names must be unique within a route.`,
    );
  }
  return name;
};

const routeShape = (path: string, segments: string[], names: Set<string>): string =>
  rootPath +
  segments
    .map((segment) => {
      if (!segment.includes(":") && !segment.includes("*")) {
        return segment.toLowerCase();
      }
      const name = dynamicParameter(path, segment, segment === segments.at(lastSegment));
      if (names.has(name)) {
        throw routePathError(
          `Invalid route path "${path}". Dynamic parameter names must be unique within a route.`,
        );
      }
      names.add(name);
      return segment.startsWith("*") ? "*" : ":";
    })
    .join(rootPath);

// oxlint-disable-next-line unicorn/no-null -- The route analysis contract uses null for an absent catch-all.
const noCatchAll = null;

const analyzePattern = (path: string, shape: string, catchAll: string | null): RoutePattern => {
  const prefix = path.slice(firstCharacter, path.lastIndexOf(rootPath) + afterLeadingSlash);
  const matcher = Predicate.isNullish(catchAll) ? path : `${prefix}*`;
  if (!isAbsolutePath(matcher)) {
    throw routePathError(`Expected an absolute route matcher for "${path}".`);
  }
  const shapes = Predicate.isNullish(catchAll)
    ? [shape]
    : [shape, shape.slice(firstCharacter, -catchAllSuffix.length) || rootPath];
  return { catchAll, matcher, shape, shapes: Object.freeze(shapes) };
};

export const analyzeRoutePath = (path: string): RouteAnalysis => {
  const segments = splitRoute(path);
  const names = new Set<string>();
  const shape = routeShape(path, segments, names);
  const parameterNames = Array.fromIterable(names);
  const catchAll =
    segments.at(lastSegment)?.startsWith("*") === true
      ? (parameterNames.at(lastSegment) ?? noCatchAll)
      : noCatchAll;
  const pattern = analyzePattern(path, shape, catchAll);
  return Array.isReadonlyArrayNonEmpty(parameterNames)
    ? routeAnalyses.Parameterized({ ...pattern, parameterNames: Object.freeze(parameterNames) })
    : routeAnalyses.ParameterFree(pattern);
};

const canMatchSegment = (segment: string | undefined, expected: string): boolean =>
  segment?.startsWith(":") === true ||
  segment?.startsWith("*") === true ||
  segment?.toLowerCase() === expected;

export const validateUnreservedPath = (path: string): void => {
  const [segment] = path.slice(afterLeadingSlash).split(rootPath);
  if (canMatchSegment(segment, "_effront")) {
    throw routePathError(
      `Route "${path}" uses the framework-reserved "${FrameworkNamespace}" namespace.`,
    );
  }
};

export const joinRoutePaths = (prefix: AbsolutePath, path: AbsolutePath): AbsolutePath => {
  if (prefix === "/") {
    return path;
  }
  if (path === "/") {
    return prefix;
  }
  return `${prefix}${path}`;
};
