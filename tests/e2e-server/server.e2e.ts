import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const httpStatusOk = 200;
const httpStatusNotModified = 304;
const httpStatusNotFound = 404;
const noBody = 0;
const noStyles = 0;
const countBefore = "Count: 0";
const countAfter = "Count: 1";
const publicFile = "/hello.txt";

type Runtime = "Bun" | "Node";
const runtimeFor = (project: string): Runtime => (project === "bun" ? "Bun" : "Node");

const expectInitialHttp = async (request: APIRequestContext, runtime: Runtime): Promise<void> => {
  const response = await request.get("/");
  expect(response.status()).toBe(httpStatusOk);
  expect(response.headers()["content-type"]).toContain("charset=utf-8");
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(await response.text()).toContain(`Hello from ${runtime}!`);
  const head = await request.head("/");
  expect(head.status()).toBe(httpStatusOk);
  expect(await head.body()).toHaveLength(noBody);
};

const hydrationErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydrat|server rendered html|did not match/iu.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
};

const openHydratedDocument = async (page: Page): Promise<void> => {
  const documentResponse = await page.goto("/");
  expect(documentResponse?.headers()["content-type"]).toContain("charset=utf-8");
  await page.waitForLoadState("networkidle");
  // oxlint-disable-next-line unicorn/text-encoding-identifier-case -- Chromium exposes the canonical Encoding Standard label through document.characterSet.
  expect(await page.evaluate(() => document.characterSet)).toBe("UTF-8");
};

const expectServerFunction = async (page: Page, runtime: Runtime): Promise<void> => {
  await page.getByRole("button", { exact: true, name: countBefore }).click();
  await expect(page.getByRole("button", { exact: true, name: countAfter })).toBeVisible();
  await page.getByRole("button", { name: "Call a Server Function" }).click();
  await expect(page.getByTestId("action-greeting")).toHaveText(`Hello from ${runtime}!, Ada!`);
};

const sampleTransition = async (page: Page): Promise<boolean> =>
  // Observe real native animation frames while navigating to the next route.
  page.evaluate(async () => {
    const timeoutMs = 5000;
    const started = 0;
    const finished = 1;
    const deadline = performance.now() + timeoutMs;
    const result = Promise.withResolvers<boolean>();
    const observe = (): void => {
      const active = document.getAnimations().some((animation) => {
        const { effect } = animation;
        if (!(effect instanceof KeyframeEffect)) {
          return false;
        }
        const progress = effect.getComputedTiming().progress ?? started;
        return (
          effect.pseudoElement?.includes("effront-page") === true &&
          animation.playState === "running" &&
          progress > started &&
          progress < finished
        );
      });
      if (active) {
        result.resolve(true);
      } else if (performance.now() >= deadline) {
        result.resolve(false);
      } else {
        requestAnimationFrame(observe);
      }
    };
    requestAnimationFrame(observe);
    return result.promise;
  });

const expectNativeNavigation = async (page: Page, runtime: Runtime): Promise<void> => {
  const transition = sampleTransition(page);
  await page.getByRole("link", { exact: true, name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/u);
  await expect(page.getByTestId("label")).toHaveText(runtime);
  expect(await transition).toBe(true);
};

test("native HTTP serves SSR, hydration, Server Functions and navigation", async ({
  page,
  request,
}, testInfo) => {
  const runtime = runtimeFor(testInfo.project.name);
  await expectInitialHttp(request, runtime);
  const errors = hydrationErrors(page);
  await openHydratedDocument(page);
  expect(errors).toEqual([]);
  await expectServerFunction(page, runtime);
  await expectNativeNavigation(page, runtime);
  expect(errors).toEqual([]);
});

const expectTextAsset = async (request: APIRequestContext, runtime: Runtime): Promise<void> => {
  const asset = await request.get(publicFile);
  expect(asset.status()).toBe(httpStatusOk);
  expect(await asset.text()).toBe(`Hello from ${runtime} public assets!\n`);
};

const expectStylesDocument = async (page: Page, request: APIRequestContext): Promise<void> => {
  await expect(page.getByRole("main")).toHaveCSS("max-width", "768px");
  await expect(page.getByRole("button", { exact: true, name: countBefore })).toHaveCSS(
    "padding-left",
    "16px",
  );
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(styles.length).toBeGreaterThan(noStyles);
  await Promise.all(
    styles.map(async (href) => {
      expect(href).toBeTruthy();
      const css = await request.get(href, { headers: { Accept: "text/css" } });
      expect(css.status()).toBe(httpStatusOk);
      expect(css.headers()["content-type"]).toContain("text/css");
    }),
  );
};

const expectWithoutScripts = async (
  browser: Browser,
  request: APIRequestContext,
  baseURL: string | undefined,
): Promise<void> => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL("/", baseURL).href);
    await expectStylesDocument(page, request);
  } finally {
    await context.close();
  }
};

test("public files and generated CSS are available in initial HTML without JavaScript", async ({
  baseURL,
  browser,
  request,
}, testInfo) => {
  await expectTextAsset(request, runtimeFor(testInfo.project.name));
  await expectWithoutScripts(browser, request, baseURL);
});

const inaccessibleFiles = [
  "/assets/missing.js",
  "/entry.server.ts",
  "/rsc/server.js",
  "/package.json",
  "/.env",
];

const expectConditionalAsset = async (request: APIRequestContext): Promise<void> => {
  const response = await request.get(publicFile);
  const { etag } = response.headers();
  expect(etag).toBeTruthy();
  const cached = await request.get(publicFile, { headers: { "If-None-Match": etag ?? "" } });
  expect(cached.status()).toBe(httpStatusNotModified);
  expect(await cached.body()).toHaveLength(noBody);
};

test("production static policy never exposes server source or replaces missing assets with HTML", async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "Vite owns the development filesystem policy");
  await Promise.all(
    inaccessibleFiles.map(async (path) => {
      const response = await request.get(path);
      expect(response.status()).toBe(httpStatusNotFound);
    }),
  );
  await expectConditionalAsset(request);
});
