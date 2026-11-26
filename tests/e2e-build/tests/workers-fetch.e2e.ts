import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const httpStatusOk = 200;
const httpStatusNotFound = 404;
const noScripts = 0;
const serverSecret = "acceptance-test-secret";

// The independent Wrangler host supplies these test-only runtime overrides.
const expected = { label: "Workers override", secretConfigured: true };

const expectResponse = async (response: APIResponse, mediaType: string): Promise<void> => {
  const body = await response.text();
  expect(response.status()).toBe(httpStatusOk);
  expect(response.headers()["content-type"]).toContain(mediaType);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["vary"]).toContain("Accept");
  expect(body).not.toContain(serverSecret);
};

const recordScripts = (page: Page): Set<string> => {
  const scripts = new Set<string>();
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      scripts.add(response.url());
    }
  });
  return scripts;
};

const openWorkersPage = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page).toHaveTitle("Effront Workers");
  await page.waitForLoadState("networkidle");
};

const expectPublicScripts = async (
  request: APIRequestContext,
  scripts: Set<string>,
): Promise<void> => {
  expect(scripts.size).toBeGreaterThan(noScripts);
  // oxlint-disable-next-line rules/no-for-loops -- Fetch and inspect one browser script at a time on the local Worker.
  for (const source of scripts) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Complete the current asset fetch before requesting the next asset.
    const asset = await request.get(source);
    expect(asset.ok()).toBeTruthy();
    // oxlint-disable-next-line eslint/no-await-in-loop -- Verify the complete asset before proceeding to the next URL.
    expect(await asset.text()).not.toContain(serverSecret);
  }
};

test("serves HTML and Flight responses without leaking server bindings", async ({
  page,
  request,
}) => {
  const html = await request.get("/");
  await expectResponse(html, "text/html");
  const flight = await request.get("/", { headers: { Accept: "text/x-component" } });
  await expectResponse(flight, "text/x-component");
  const scripts = recordScripts(page);
  await openWorkersPage(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(expected.label);
  await expect(page.getByTestId("secret-status")).toHaveText(
    expected.secretConfigured ? "Server secret configured" : "No server secret",
  );
  await expect(page.locator("body")).not.toContainText(serverSecret);
  await expectPublicScripts(request, scripts);
});

const expectRoundTripNavigation = async (page: Page): Promise<void> => {
  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
  await expect(page.getByTestId("label")).toHaveText(expected.label);

  await page.getByRole("link", { name: "Back home" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(expected.label);
};

test("hydrates the client counter and navigates application links", async ({ page }) => {
  await openWorkersPage(page);
  const counter = page.getByRole("button", { name: "Count: 0" });
  await expect(counter).toBeVisible();
  await counter.click();
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
  await expectRoundTripNavigation(page);
});

test("invokes a Server Function with the request-scoped Workers greeting binding", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Read greeting binding" }).click();
  await expect(page.getByTestId("action-greeting")).toHaveText("Hello from workerd binding, Ada!");
});

test("returns a non-success response for an unknown route", async ({ request }) => {
  const response = await request.get("/not-a-route");
  expect(response.status()).toBe(httpStatusNotFound);
});
