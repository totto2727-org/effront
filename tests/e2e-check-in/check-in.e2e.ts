import { expect, test } from "@playwright/test";

test("uses one root atom registry for scoped preview refreshes and idempotent check-in", async ({
  page,
}) => {
  const queries: string[] = [];
  const actions: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/_effront/query")) queries.push(request.url());
    if (request.method() === "POST") actions.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByTestId("scope")).toHaveText("Authorized organizer: Ada Organizer");
  await expect(page.getByText("Node Summit check-in")).toBeVisible();
  await expect(page.getByTestId("audit-count")).toHaveText("0");

  await page.getByLabel("Ticket code").fill("PRIVATE-BEN");
  await page.getByRole("button", { name: "Check in attendee" }).click();
  await expect(page.getByTestId("check-in-result")).toHaveText(
    "This organizer cannot check in that ticket.",
  );
  await expect(page.getByTestId("audit-count")).toHaveText("0");

  await page.getByLabel("Ticket code").fill("SUMMIT-ADA");
  await page.getByRole("button", { name: "Check in attendee" }).click();
  await expect(page.getByTestId("check-in-result")).toContainText("Ada Lovelace checked in");
  await expect(page.getByTestId("audit-count")).toHaveText("1");

  await page.getByRole("button", { name: "Check in attendee" }).click();
  await expect(page.getByTestId("check-in-result")).toContainText(
    "Ada Lovelace was already checked in",
  );
  await expect(page.getByTestId("audit-count")).toHaveText("1");

  expect(actions.some((url) => !url.includes("@vite"))).toBe(true);
  expect(queries.length).toBeGreaterThanOrEqual(3);
});
