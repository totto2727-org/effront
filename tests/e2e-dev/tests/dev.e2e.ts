// oxlint-disable-next-line rules/no-node-imports -- This development test edits and restores real Markdown source files.
import { readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Use native paths for the watched fixture's content directory.
import path from "node:path";

import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const testTimeout = 45_000;
const editTimeout = 15_000;
const routeTimeout = 10_000;
const ok = 200;
const missing = 404;
const noOverlay = 0;
const contentDirectory = path.resolve(import.meta.dirname, "../fixture/content");
const manualFile = path.join(contentDirectory, "manual.md");

const recordErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydrat|server rendered html|did not match/iu.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
};

type AddedPage = Readonly<{ file: string; url: string }>;

const makeAddedPage = (): AddedPage => {
  const stem = `acceptance-added-${crypto.randomUUID()}%20literal`;
  return {
    file: path.join(contentDirectory, "manual/guide", `${stem}.md`),
    url: `/manual/guide/${encodeURIComponent(stem)}`,
  };
};

const editExistingPage = async (page: Page, original: Buffer): Promise<void> => {
  await writeFile(
    manualFile,
    Buffer.concat([original, Buffer.from("\n\nAcceptance live update\n")]),
  );
  await expect(page.getByText("Acceptance live update", { exact: true })).toBeVisible({
    timeout: editTimeout,
  });
};

const expectRoute = async (
  request: APIRequestContext,
  url: string,
  status: number,
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const response = await request.get(url);
        return response.status();
      },
      { timeout: routeTimeout },
    )
    .toBe(status);
};

const discoverAndRemove = async (
  page: Page,
  request: APIRequestContext,
  added: AddedPage,
): Promise<void> => {
  await writeFile(added.file, "# Added Markdown page\n\nDiscovered from the source glob.\n", {
    flag: "wx",
  });
  await expectRoute(request, added.url, ok);
  await page.goto(added.url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Added Markdown page");
  await rm(added.file);
  await expectRoute(request, added.url, missing);
};

const restoreSource = async (original: Buffer, added: AddedPage): Promise<void> => {
  try {
    await writeFile(manualFile, original);
  } finally {
    await rm(added.file, { force: true });
  }
};

const openManual = async (page: Page): Promise<Buffer> => {
  const original = await readFile(manualFile);
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  return original;
};

test("updates edited Markdown and discovers added and removed source pages in development", async ({
  page,
  request,
}) => {
  test.setTimeout(testTimeout);
  const errors = recordErrors(page);
  const added = makeAddedPage();
  const original = await openManual(page);
  try {
    await editExistingPage(page, original);
    await discoverAndRemove(page, request, added);
    await expect(page.locator("vite-error-overlay")).toHaveCount(noOverlay);
    expect(errors, "Content updates must not introduce browser or hydration faults").toEqual([]);
  } finally {
    await restoreSource(original, added);
  }
});
