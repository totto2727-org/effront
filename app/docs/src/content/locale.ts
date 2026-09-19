export type DocLocale = "en" | "ja";

export function documentLocale(pathname: string): DocLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ja";
}

export function documentPath(pathname: string): string {
  if (pathname === "/en" || pathname === "/ja") return "/";
  return pathname.replace(/^\/(en|ja)\//, "/");
}

export function localizedPath(pathname: string, locale: DocLocale): string {
  const path = documentPath(pathname);
  return `/${locale}${path === "/" ? "" : path}`;
}

export function localizeDocumentLink(
  href: string | undefined,
  locale: DocLocale,
): string | undefined {
  if (!href?.startsWith("/") || href.startsWith("//")) return href;
  if (/^\/(en|ja)(?:\/|$|[?#])/.test(href)) return href;
  return `/${locale}${href === "/" ? "" : href}`;
}
