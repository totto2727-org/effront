import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { Reader } from "./reader-journey.browser.fixture.ts";
import { followHeading, openGuide, readers } from "./reader-journey.browser.fixture.ts";

const openMutationGuide = async (page: Page, reader: Reader): Promise<void> => {
  await openGuide(page, reader, "/guide/server-functions");
  await Promise.all(
    ["mutation", "query", "stream"].map(async (kind) =>
      expect(
        page.locator(`article a[href="/${reader.locale}/guide/${kind}-server-functions"]`),
      ).toBeVisible(),
    ),
  );
  const path = `/${reader.locale}/guide/mutation-server-functions`;
  await page.locator(`article a[href="${path}"]`).click();
  await expect(page).toHaveURL(path);
  const ids = await page
    .locator("article h2")
    .evaluateAll((headings) => headings.map((heading) => heading.id));
  expect(ids).toEqual(["identity", "forms", "application", "state", "input", "refresh", "errors"]);
};

const expectDirectForm = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "forms");
  const handler = page.locator("article pre code").filter({ hasText: "export const recordName" });
  await expect(handler).toContainText('Effect.logInfo("Name submitted", { name })');
  await followHeading(page, reader, "application");
  await expect(
    page.locator("article pre code").filter({ hasText: "<form action={recordName}>" }),
  ).toContainText("Record name");
};

const expectActionState = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "state");
  const state = page.locator("article pre code").filter({ hasText: "useActionState(greet" });
  await expect(state).toContainText(
    'const [state, formAction, pending] = useActionState(greet, { message: "" })',
  );
  await expect(state).toContainText("<form action={formAction}>");
  await expect(state).toContainText("disabled={pending}");
  await expect(state).toContainText('aria-live="polite"');
  await expect(page.locator("article")).toContainText("Hello, Ada.");
};

const expectBusinessFailure = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "errors");
  const failure = page.locator("article pre code").filter({ hasText: 'name === "Admin"' });
  await expect(failure).toContainText('Effect.succeed({ message: "That name is reserved." })');
  await expect(failure).toContainText("Schema.NonEmptyString");
  await expect(page.locator("article")).toContainText("That name is reserved.");
};

type Alert = Readonly<{ content: string; kind: "important" | "warning"; title: string }>;

const expectAlert = async (page: Page, { content, kind, title }: Alert): Promise<string> => {
  const alert = page.locator(`article [data-alert="${kind}"]`);
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(content);
  await expect(alert).not.toContainText(`[!${kind.toUpperCase()}]`);
  await expect(alert).toHaveCSS("font-style", "normal");
  await expect(alert.locator(".docs-alert-title")).toHaveText(title);
  await expect(alert.locator("svg")).toBeVisible();
  return alert.evaluate((element) => getComputedStyle(element).borderInlineStartColor);
};

readers.forEach((reader) => {
  test(`${reader.locale} reader starts with a direct form before adding action state`, async ({
    page,
  }) => {
    await openMutationGuide(page, reader);
    await expectDirectForm(page, reader);
    await expectActionState(page, reader);
    await expectBusinessFailure(page, reader);
  });

  test(`${reader.locale} reader sees typed caution callouts rather than literal alert markers`, async ({
    page,
  }) => {
    await page.goto(`/${reader.locale}/guide/components`);
    const warning = await expectAlert(page, {
      content: "props",
      kind: "warning",
      title: "Warning",
    });
    await page.goto(`/${reader.locale}/platforms/alchemy`);
    const important = await expectAlert(page, {
      content: "2.0.0-beta.81",
      kind: "important",
      title: "Important",
    });
    expect(important).not.toBe(warning);
  });
});
