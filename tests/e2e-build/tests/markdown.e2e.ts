import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { Predicate } from "effect";

import { docsTest as test } from "./docs-host.fixture.ts";
import { observeMarkdownFlight, observedFlightBody } from "./flight-observation.fixture.ts";
import {
  expectArticleTitle,
  headingSelector,
  manualArticle,
} from "./layout-assertions.browser.fixture.ts";
import { destinations } from "./markdown-destinations.fixture.ts";

const httpStatusOk = 200;
const httpStatusNotFound = 404;
const richRendererCount = 2;
const flightMediaType = "text/x-component";
const manualTitle = "Markdown manual";
type Destination = (typeof destinations)[number];

[{ path: "/manual", title: manualTitle }, ...destinations].forEach(({ path, title }) => {
  test(`negotiates native Flight for ${title}`, async ({ request }) => {
    const response = await request.get(path, { headers: { Accept: flightMediaType } });
    expect(response.status()).toBe(httpStatusOk);
    const headers = response.headers();
    expect(headers["content-type"]).toContain(flightMediaType);
    expect(headers["vary"]).toContain("Accept");
    const body = await response.text();
    expect(body).toContain(title);
    expect(body).not.toMatch(/<!doctype html/iu);
    expect(body).not.toMatch(/"digest":/u);
  });
});

const unindexedPaths = [
  "/manual/guide/%",
  "/manual/guide/%E0%A4%A",
  "/manual/guide%2Fdeep/details",
  "/manual/guide%5Cdeep/details",
  "/manual/guide/deep/details%00",
  "/manual/guide//deep/details",
  "/manual/guide%252Fdeep/details",
];

const expectUnindexedDocument = async (
  request: APIRequestContext,
  accept: string,
  path: string,
): Promise<void> => {
  const response = await request.get(path, { headers: { Accept: accept } });
  expect(response.status(), `No indexed document for ${path}, without aliasing or throwing`).toBe(
    httpStatusNotFound,
  );
  expect(await response.text()).not.toContain("Deep details");
};

["text/html", flightMediaType].forEach((accept) => {
  test(`returns 404 for unknown nested Markdown content with ${accept}`, async ({ request }) => {
    const response = await request.get("/manual/guide/deep/unknown", {
      headers: { Accept: accept },
    });
    expect(response.status()).toBe(httpStatusNotFound);
  });

  test(`returns 404 for unindexed URL segments without aliasing Markdown content with ${accept}`, async ({
    request,
  }) => {
    await Promise.all(
      unindexedPaths.map(async (path) => expectUnindexedDocument(request, accept, path)),
    );
  });
});

const verifyAnchorNavigation = async (page: Page, url: URL, hash: string): Promise<void> => {
  expect(url.search).toBe("?from=manual");
  expect(url.hash).toBe(`#${hash}`);
  await expect(page.locator(headingSelector(`#${hash}`))).toBeInViewport();
};

const clickMarkdownLink = async (page: Page, title: string): Promise<void> => {
  const link = manualArticle(page).getByRole("link", { exact: true, name: title });
  await link.click();
};

const expectCounterPreserved = async (page: Page): Promise<void> => {
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
};

const verifyMarkdownFlight = async (
  page: Page,
  { hash, path, title }: Destination,
): Promise<void> => {
  const flightResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.headers()["content-type"]?.includes(flightMediaType) === true,
  );
  const [flight] = await Promise.all([flightResponse, clickMarkdownLink(page, title)]);
  expect(flight.status()).toBe(httpStatusOk);
  expect(flight.headers()["content-type"]).toContain(flightMediaType);
  await expect.poll(async () => observedFlightBody(page, flight.url())).toContain(title);
  await expectArticleTitle(manualArticle(page), title);
  const url = new URL(page.url());
  expect(url.pathname).toBe(path);
  if (Predicate.isNotNullish(hash)) {
    await verifyAnchorNavigation(page, url, hash);
  }
};

const openHydratedManual = async (page: Page): Promise<void> => {
  await observeMarkdownFlight(
    page,
    destinations.map(({ path }) => path),
  );
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { exact: true, name: "Count: 0" }).click();
  await expectCounterPreserved(page);
};

const observeDocumentRequests = (page: Page): string[] => {
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests.push(request.url());
    }
  });
  return documentRequests;
};

const verifyNavigationAndReturn = async (page: Page, destination: Destination): Promise<void> => {
  await verifyMarkdownFlight(page, destination);
  await expectCounterPreserved(page);
  await page.goBack();
  await expectArticleTitle(manualArticle(page), manualTitle);
  await expectCounterPreserved(page);
};

const verifyManualStillInteractive = async (page: Page): Promise<void> => {
  await page.goForward();
  await expectArticleTitle(manualArticle(page), "Unicode page");
  await clickMarkdownLink(page, "Manual home");
  await expectArticleTitle(manualArticle(page), manualTitle);
  await page.getByRole("button", { exact: true, name: "Count: 1" }).click();
  await expect(page.getByRole("button", { exact: true, name: "Count: 2" })).toBeVisible();
  await expect(page.locator(".math .katex")).toHaveCount(richRendererCount);
  await expect(page.locator(".mermaid svg")).toHaveCount(richRendererCount);
};

test("hydrates and follows Markdown links with Flight while retaining shared layout state", async ({
  page,
}) => {
  await openHydratedManual(page);
  const documentRequests = observeDocumentRequests(page);
  // oxlint-disable-next-line rules/no-for-loops -- Each link and backward navigation uses the same browser page.
  for (const destination of destinations) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Restore the manual before following the next link.
    await verifyNavigationAndReturn(page, destination);
  }
  await verifyManualStillInteractive(page);
  expect(documentRequests, "Markdown and history navigation must not reload the document").toEqual(
    [],
  );
});
