import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const minimumRefreshes = 3;
type ObservedRequests = Readonly<{ actions: string[]; queries: string[] }>;

const recordRequests = (page: Page): ObservedRequests => {
  const queries: string[] = [];
  const actions: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/_effront/query")) {
      queries.push(request.url());
    }
    if (request.method() === "POST") {
      actions.push(request.url());
    }
  });
  return { actions, queries };
};

const submit = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Check in attendee" }).click();
};

const expectAuthorizedPreview = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page.getByTestId("scope")).toHaveText("Authorized organizer: Ada Organizer");
  await expect(page.getByText("Workers Summit check-in")).toBeVisible();
  await expect(page.getByTestId("audit-count")).toHaveText("0");
};

const expectUnauthorizedTicket = async (page: Page): Promise<void> => {
  await page.getByLabel("Ticket code").fill("PRIVATE-BEN");
  await submit(page);
  await expect(page.getByTestId("check-in-result")).toHaveText(
    "This organizer cannot check in that ticket.",
  );
  await expect(page.getByTestId("audit-count")).toHaveText("0");
};

const expectIdempotentCheckIn = async (page: Page): Promise<void> => {
  await page.getByLabel("Ticket code").fill("SUMMIT-ADA");
  await submit(page);
  await expect(page.getByTestId("check-in-result")).toContainText("Ada Lovelace checked in");
  await expect(page.getByTestId("audit-count")).toHaveText("1");

  await submit(page);
  await expect(page.getByTestId("check-in-result")).toContainText(
    "Ada Lovelace was already checked in",
  );
  await expect(page.getByTestId("audit-count")).toHaveText("1");
};

test("uses one root atom registry for scoped preview refreshes and idempotent check-in", async ({
  page,
}) => {
  const { actions, queries } = recordRequests(page);
  await expectAuthorizedPreview(page);
  await expectUnauthorizedTicket(page);
  await expectIdempotentCheckIn(page);
  expect(actions.some((url) => !url.includes("@vite"))).toBe(true);
  expect(queries.length).toBeGreaterThanOrEqual(minimumRefreshes);
});
