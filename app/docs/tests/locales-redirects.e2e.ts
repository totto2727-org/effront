import type { APIResponse } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { LocaleDocs } from "./locales.fixture.ts";
import { locales, localizedUrl, metadata, retiredArticles } from "./locales.fixture.ts";

const httpStatusOk = 200;
const httpStatusPermanentRedirect = 308;
const httpStatusNotFound = 404;
const noBody = 0;
const noRedirects = 0;
const bookmarkQuery = "?from=bookmark";
const contentTypes = ["text/html", "text/x-component"];
const methods = ["GET", "HEAD"];

const unknownPaths = [
  "/not-a-document",
  "/index",
  "/reading/overview",
  "/advanced/production-startup-extra",
  "/guide/testing-extra",
  "/platforms/node-bun-extra",
];

type Bookmark = Readonly<{
  accept: string;
  canonical: string;
  method: string;
  retired: string;
}>;

const expectRedirect = async (response: APIResponse, location: string): Promise<void> => {
  expect(response.status()).toBe(httpStatusPermanentRedirect);
  expect(response.headers()["location"]).toBe(location);
  expect(await response.body()).toHaveLength(noBody);
};

const expectDestination = async (
  response: APIResponse,
  docs: LocaleDocs,
  { accept, canonical, method }: Bookmark,
): Promise<void> => {
  expect(response.status()).toBe(httpStatusOk);
  const destination = new URL(response.url());
  expect(destination.pathname).toBe(localizedUrl(docs, canonical));
  expect(destination.search).toBe(bookmarkQuery);
  expect(response.headers()["content-type"]).toContain(accept);
  if (method === "HEAD") {
    expect(await response.body()).toHaveLength(noBody);
  } else {
    expect(await response.text()).toContain(metadata(docs, canonical).title);
  }
};

const registerRedirect = (docs: LocaleDocs, bookmark: Bookmark): void => {
  const { accept, canonical, method, retired } = bookmark;
  const retiredUrl = localizedUrl(docs, retired);
  test(`${retiredUrl} redirects ${method} ${accept} within its locale`, async ({ request }) => {
    const url = `${retiredUrl}${bookmarkQuery}`;
    const headers = { Accept: accept };
    const response = await request.fetch(url, { headers, maxRedirects: noRedirects, method });
    await expectRedirect(response, `${localizedUrl(docs, canonical)}${bookmarkQuery}`);
    const followed = await request.fetch(url, { headers, method });
    await expectDestination(followed, docs, bookmark);
  });
};

locales.forEach((docs) => {
  retiredArticles.forEach(({ canonical, retired }) => {
    contentTypes.forEach((accept) => {
      methods.forEach((method) => {
        registerRedirect(docs, { accept, canonical, method, retired });
      });
    });
  });

  unknownPaths.forEach((path) => {
    const url = localizedUrl(docs, path);
    contentTypes.forEach((accept) => {
      test(`${url} returns a real ${accept} 404`, async ({ request }) => {
        const response = await request.get(url, {
          headers: { Accept: accept },
          maxRedirects: noRedirects,
        });
        expect(response.status()).toBe(httpStatusNotFound);
      });
    });
  });
});
