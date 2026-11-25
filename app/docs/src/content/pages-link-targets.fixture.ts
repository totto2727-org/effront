import { Array, String } from "effect";

import { documentLocale, localizedPath } from "./locale.ts";
import { render } from "./pages-render.fixture.ts";
import { getPage } from "./pages.ts";

const idPattern = /\bid="(?<id>[^"]+)"/gu;
const headingPattern = /<h[2-6]\b[^>]*\bid="(?<id>[^"]+)"/gu;
const hrefPattern = /href="(?<href>[^"]+)"/gu;
const externalHref = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;
const localePath = /^\/(?:en|ja)(?:\/|$)/u;
const validHeadingId = /^[a-z][a-z0-9-]*$/u;

const capture = (html: string, pattern: RegExp, group: string): string[] => {
  const matches = Array.fromIterable(html.matchAll(pattern));
  return Array.map(matches, ({ groups }) => groups?.[group] ?? "");
};

export const renderedIds = (html: string): string[] => capture(html, idPattern, "id");
export const renderedHeadings = (html: string): string[] => capture(html, headingPattern, "id");

export const invalidDeclaredHeadings = (declared: string[], actual: string[]): string[] =>
  Array.filter(declared, (id) => !validHeadingId.test(id) || !actual.includes(id));

type Target = Readonly<{ href: string; target: string; url: URL }>;

export const internalTargets = (html: string, slug: string): Target[] => {
  const root = `https://docs.example${slug}`;
  const links = Array.filter(
    capture(html, hrefPattern, "href"),
    (href) => !String.isEmpty(href) && !externalHref.test(href),
  );
  return Array.map(links, (href) => {
    const url = new URL(href, root);
    return { href, target: getPage(url.pathname).slug, url };
  });
};

export const incorrectlyLocalized = (links: Target[], slug: string): string[] => {
  if (!localePath.test(slug)) {
    return [];
  }
  const locale = documentLocale(slug);
  const invalid = Array.filter(links, ({ target }) => target !== localizedPath(target, locale));
  return Array.map(invalid, ({ href }) => href);
};

const fragmentPrefix = "#";
export const missingFragments = async (
  links: Target[],
  current: Readonly<{ html: string; slug: string }>,
): Promise<string[]> => {
  const anchored = Array.filter(links, ({ url }) => !String.isEmpty(url.hash));
  return Array.reduce(
    anchored,
    Promise.resolve(Array.empty<string>()),
    async (pending, { href, target, url }) => {
      const missing = await pending;
      const html = url.pathname === current.slug ? current.html : await render(target);
      const id = decodeURIComponent(url.hash.slice(fragmentPrefix.length));
      return html.includes(`id="${id}"`) ? missing : Array.append(missing, href);
    },
  );
};
