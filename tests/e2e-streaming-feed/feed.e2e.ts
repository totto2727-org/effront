import type { Page, Request } from "@playwright/test";
import { expect, test } from "@playwright/test";

const seedNotes = 6;
const expandedNotes = 12;
const queryRequests = 2;
const firstFailure = 1;
const noAlerts = 0;
const storyCard = "[data-story-id]";
const firstStoryCard = '[data-story-id="1"]';
const firstAdditionalCard = '[data-story-id="7"]';
const queryPath = "/_effront/query";
const loadMore = "Load 6 more notes";

const expectSeed = async (page: Page): Promise<void> => {
  await expect(page.locator(storyCard)).toHaveCount(seedNotes);
  await expect(page.getByRole("heading", { name: "Field note 1" })).toBeVisible();
};

test("initial feed renders six notes without JavaScript", async ({ baseURL, browser, page }) => {
  await page.goto("/");
  await expectSeed(page);

  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const document = await context.newPage();
    await document.goto(new URL("/", baseURL).href);
    await expectSeed(document);
  } finally {
    await context.close();
  }
});

const openHydratedFeed = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
};

const isQueryRequest = (request: Request): boolean =>
  request.method() === "POST" && request.url().endsWith(queryPath);

const recordRequests = (page: Page, isObserved: (request: Request) => boolean): string[] => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isObserved(request)) {
      requests.push(request.url());
    }
  });
  return requests;
};

const expectIncrementalNotes = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: loadMore }).click();
  await page.locator(firstAdditionalCard).waitFor();
  const count = await page.locator(storyCard).count();
  expect(count).toBeLessThan(expandedNotes);
  await expect(page.locator(storyCard)).toHaveCount(expandedNotes);
};

test("loading next page streams notes without navigation or discarding expanded cards", async ({
  page,
}) => {
  const requests = recordRequests(page, isQueryRequest);
  await openHydratedFeed(page);
  const documents = recordRequests(page, (request) => request.isNavigationRequest());
  const first = page.locator(firstStoryCard);
  await first.getByRole("button", { name: "Read note" }).click();
  await expect(first).toContainText("The full story for note 1");
  await expectIncrementalNotes(page);
  await expect(first.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  expect({ documents, requestCount: requests.length }).toStrictEqual({
    documents: [],
    requestCount: queryRequests,
  });
  expect(requests.every((url) => url.endsWith(queryPath))).toBe(true);
});

const abortFirstQuery = async (page: Page): Promise<void> => {
  await page.route(`**${queryPath}`, async (route) => route.abort(), { times: firstFailure });
};

test("failed page query retries without losing previously received notes", async ({ page }) => {
  await openHydratedFeed(page);
  await abortFirstQuery(page);
  await page.getByRole("button", { name: loadMore }).click();
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await expect(page.locator(storyCard)).toHaveCount(seedNotes);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(storyCard)).toHaveCount(expandedNotes);
  await expect(page.getByRole("alert")).toHaveCount(noAlerts);
});

test("failed note query can be retried without refreshing the feed", async ({ page }) => {
  await openHydratedFeed(page);
  await abortFirstQuery(page);
  const first = page.locator(firstStoryCard);
  await first.getByRole("button", { name: "Read note" }).click();
  await first.getByRole("button", { name: "Retry note" }).click();
  await expect(first).toContainText("The full story for note 1");
  await expect(page.locator(storyCard)).toHaveCount(seedNotes);
});

test("navigating away interrupts an unfinished stream", async ({ page }) => {
  await openHydratedFeed(page);
  const request = page.waitForRequest(isQueryRequest);
  await page.getByRole("button", { name: loadMore }).click();
  const pending = await request;
  await page.locator(firstAdditionalCard).waitFor();
  const aborted = page.waitForEvent("requestfailed", { predicate: (failed) => failed === pending });
  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("heading", { name: "About this feed" })).toBeVisible();
  await aborted;
});
