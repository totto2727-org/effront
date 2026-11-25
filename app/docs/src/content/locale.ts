import { Predicate } from "effect";

export type DocLocale = "en" | "ja";

export const documentLocale = (pathname: string): DocLocale =>
  pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ja";

export const hasDocumentLocale = (pathname: string): boolean =>
  /^\/(?:en|ja)(?:\/|$)/u.test(pathname);

export const documentPath = (pathname: string): string => {
  if (pathname === "/en" || pathname === "/ja") {
    return "/";
  }
  return pathname.replace(/^\/(?:en|ja)\//u, "/");
};

export const localizedPath = (pathname: string, locale: DocLocale): string => {
  const path = documentPath(pathname);
  return `/${locale}${path === "/" ? "" : path}`;
};

export const localizeDocumentLink = (
  href: string | undefined,
  locale: DocLocale,
): string | undefined => {
  if (Predicate.isNullish(href) || !href.startsWith("/") || href.startsWith("//")) {
    return href;
  }
  if (/^\/(?:en|ja)(?:\/|$|[?#])/u.test(href)) {
    return href;
  }
  return `/${locale}${href === "/" ? "" : href}`;
};
