import { expect, test } from "@playwright/test";

test("native HTTP serves SSR, hydration, Server Functions and navigation", async ({
  page,
  request,
}, testInfo) => {
  const runtime = testInfo.project.name === "bun" ? "Bun" : "Node";
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(`Hello from ${runtime}!`);
  const head = await request.head("/");
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydrat|server rendered html|did not match/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Call a Server Function" }).click();
  await expect(page.getByTestId("action-greeting")).toHaveText(`Hello from ${runtime}!, Ada!`);
  // Observe real native animation frames, not a mocked transition API or React callback.
  const transition = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const deadline = performance.now() + 5_000;
        const observe = () => {
          for (const animation of document.getAnimations()) {
            const effect = animation.effect;
            if (!(effect instanceof KeyframeEffect)) continue;
            const progress = effect.getComputedTiming().progress;
            if (
              effect.pseudoElement?.includes("effront-page") &&
              animation.playState === "running" &&
              typeof progress === "number" &&
              progress > 0 &&
              progress < 1
            ) {
              resolve(true);
              return;
            }
          }
          if (performance.now() >= deadline) resolve(false);
          else requestAnimationFrame(observe);
        };
        requestAnimationFrame(observe);
      }),
  );
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId("label")).toHaveText(runtime);
  expect(await transition).toBe(true);
  expect(errors).toEqual([]);
});

test("public files and generated CSS are available in initial HTML without JavaScript", async ({
  browser,
  baseURL,
  request,
}, testInfo) => {
  const runtime = testInfo.project.name === "bun" ? "Bun" : "Node";
  const asset = await request.get("/hello.txt");
  expect(asset.status()).toBe(200);
  expect(await asset.text()).toBe(`Hello from ${runtime} public assets!\n`);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL!);
    await expect(page.getByRole("main")).toHaveCSS("max-width", "768px");
    await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toHaveCSS(
      "padding-left",
      "16px",
    );
    const styles = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(styles.length).toBeGreaterThan(0);
    for (const href of styles) {
      const css = await request.get(href!, { headers: { Accept: "text/css" } });
      expect(css.status()).toBe(200);
      expect(css.headers()["content-type"]).toContain("text/css");
    }
  } finally {
    await context.close();
  }
});

test("production static policy never exposes server source or replaces missing assets with HTML", async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "Vite owns the development filesystem policy");
  for (const path of [
    "/assets/missing.js",
    "/entry.server.ts",
    "/rsc/server.js",
    "/package.json",
    "/.env",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
  }
  const response = await request.get("/hello.txt");
  const etag = response.headers()["etag"];
  expect(etag).toBeTruthy();
  const cached = await request.get("/hello.txt", { headers: { "If-None-Match": etag! } });
  expect(cached.status()).toBe(304);
  expect(await cached.body()).toHaveLength(0);
});
