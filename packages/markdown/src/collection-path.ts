import { Array, String } from "effect";

const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
const missingSeparator = -1;
export const splitReference = (reference: string): Readonly<[string, string]> => {
  const index = reference.search(/[?#]/u);
  return index === missingSeparator
    ? [reference, ""]
    : [String.takeLeft(reference, index), reference.slice(index)];
};
export const segments = (path: string): string[] =>
  path.split("/").filter((part) => String.isNonEmpty(part) && part !== ".");
export const encodedPathname = (parts: Readonly<string[]>): string =>
  `/${Array.map(parts, encodeURIComponent).join("/")}`;
const slashLength = "/".length;

// Encode each decoded URL segment before POSIX normalization so %2F stays a filename character.
export const encodeReference = (path: string): string => {
  const decoded = Array.map(path.split("/"), decodeSegment);
  return Array.map(decoded, encodeURIComponent).join("/");
};
export const isOutsideBase = (relative: string): boolean =>
  relative === ".." || relative.startsWith("../");

export const findEntry = <Entry>(
  entries: ReadonlyMap<string, Entry>,
  pathname: string,
): Entry | undefined => {
  const [path] = splitReference(pathname);
  const withoutTrailingSlash = path.replace(/(?<last>[^/])\/$/u, "$<last>");
  const parts = withoutTrailingSlash.slice(slashLength).split("/");
  return path.startsWith("/")
    ? entries.get(encodedPathname(Array.map(parts, decodeSegment)))
    : undefined;
};
