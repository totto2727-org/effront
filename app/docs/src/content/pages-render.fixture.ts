import { Effect, Predicate } from "effect";
import { renderToStaticMarkup } from "react-dom/server";

import { getPage } from "./pages.ts";

const renderedPages = new Map<string, Promise<string>>();

const renderDocument = Effect.fn("effront.test.renderDocumentation")((slug: string) =>
  getPage(slug).content().pipe(Effect.map(renderToStaticMarkup)),
);

export const render = async (slug: string): Promise<string> => {
  const cached = renderedPages.get(slug);
  if (Predicate.isNotNullish(cached)) {
    return cached;
  }
  // oxlint-disable-next-line rules/no-effect-runtime-run -- This fixture starts a complete server-rendering job from the Vitest Promise boundary.
  const result = Effect.runPromise(renderDocument(slug));
  renderedPages.set(slug, result);
  return result;
};

export const textOf = (html: string): string => html.replaceAll(/<[^>]*>/gu, "");

export const text = async (slug: string): Promise<string> => textOf(await render(slug));
