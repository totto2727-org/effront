import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(packageRoot, "tmp/app");
const counterFile = join(appRoot, "src/components/counter.tsx");
const dependencyFile = join(appRoot, "src/late-dependency.ts");
const hostLogFile = join(packageRoot, "tmp/host.log");
const warm = process.env["EFFRONT_TEST_WARM"] === "1";
const acceptedFile = join(appRoot, "src/accepted-hmr.ts");

type DocumentTransitions = { active: Set<number>; recovered: Map<number, number> };

type Host = {
  ledger: Record<string, number>;
  reloads: Array<{ environment: string; hash: string; path?: string; triggeredBy?: string }>;
  updates: Array<{ environment: string; paths: string[] }>;
  environments: Record<
    string,
    { hash: string; optimized: Record<string, string>; noDiscovery: boolean; include: string[] }
  >;
};

async function host(request: APIRequestContext): Promise<Host> {
  const response = await request.get("/__test/host");
  expect(response.status()).toBe(200);
  return response.json();
}

async function nonce(request: APIRequestContext): Promise<string> {
  const response = await request.get("/__test/nonce", { timeout: 10_000, maxRetries: 0 });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.seed).toBe("onetwo");
  expect(body.nonce).toMatch(/^[\da-f-]{36}$/);
  return body.nonce;
}

async function applicationWorks(page: Page, request: APIRequestContext) {
  const response = await request.get("/", { maxRetries: 0 });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("Hello from Alchemy KV");
  expect(html).toContain("</html>");
  const head = await request.head("/");
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  // Fresh-request acceptance is separate from automatic recovery, asserted below.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toHaveAttribute(
    "data-test-hydrated",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("kv-greeting")).toHaveText("Hello from Alchemy KV");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  const action = page.waitForResponse((value) => value.request().method() === "POST");
  // Deliberately one click, not expect.toPass around the mutation.
  await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
  expect((await action).status()).toBe(200);
  await expect(page.getByTestId("action-greeting")).toHaveText("Hello from Alchemy KV, Ada!");
  const navigation = page.waitForResponse(
    (value) => value.url().includes("/about") && value.request().resourceType() === "fetch",
  );
  await page.getByRole("link", { name: "About", exact: true }).click();
  expect((await navigation).status()).toBe(200);
  await expect(page.getByTestId("label")).toHaveText("Effront + Alchemy");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toHaveAttribute(
    "data-test-hydrated",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toBeVisible();
}

async function acceptedUpdateWorks(page: Page, request: APIRequestContext) {
  const original = await readFile(acceptedFile, "utf8");
  await page.addScriptTag({ type: "module", url: "/src/accepted-hmr.ts" });
  await expect(page.locator("html")).toHaveAttribute("data-test-accepted", "before");
  const counter = page.getByRole("button", { name: /^Count: \d+$/ });
  const label = await counter.innerText();
  const beforeNonce = await nonce(request);
  const beforeDocument = await page.evaluate(() => performance.timeOrigin);
  const before = await host(request);
  try {
    await writeFile(acceptedFile, original.replace("before", "after"));
    await expect(page.locator("html")).toHaveAttribute("data-test-accepted", "after");
    const after = await host(request);
    expect(after.updates.slice(before.updates.length)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          environment: "client",
          paths: expect.arrayContaining([expect.stringContaining("accepted-hmr.ts")]),
        }),
      ]),
    );
    expect(
      after.reloads.slice(before.reloads.length).filter((event) => event.environment !== "client"),
    ).toEqual([]);
    expect(await nonce(request)).toBe(beforeNonce);
    await expect(counter).toHaveText(label);
  } finally {
    await writeFile(acceptedFile, original);
    await expect(page.locator("html")).toHaveAttribute("data-test-accepted", "before");
    const observed = await host(request);
    await test.info().attach("accepted-update-payloads", {
      body: JSON.stringify(
        {
          updates: observed.updates.slice(before.updates.length),
          reloads: observed.reloads.slice(before.reloads.length),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  }
  expect(await nonce(request)).toBe(beforeNonce);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(beforeDocument);
  await expect(counter).toHaveText(label);
}

async function automaticDocumentRecovery(page: Page, beforeDocument: number, label: string) {
  // This waits across navigation, never initiates it. Old hydrated DOM cannot pass.
  await page.waitForFunction((before) => performance.timeOrigin !== before, beforeDocument, {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: `${label}: 0`, exact: true })).toHaveAttribute(
    "data-test-hydrated",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("kv-greeting")).toHaveText("Hello from Alchemy KV");
  const successor = await page.evaluate(() => performance.timeOrigin);
  expect(successor).not.toBe(beforeDocument);
  return successor;
}

async function sourceFullReload(
  page: Page,
  request: APIRequestContext,
  source: string,
  label: string,
  documents: DocumentTransitions,
) {
  const beforeDocument = await page.evaluate(() => performance.timeOrigin);
  const beforeNonce = await nonce(request);
  const before = await host(request);
  const offset = (await readFile(hostLogFile, "utf8")).length;
  documents.active.add(beforeDocument);
  await writeFile(counterFile, source);
  // Server full reload replaces both isolate and browser document. State may reset.
  const successor = await automaticDocumentRecovery(page, beforeDocument, label);
  documents.active.delete(beforeDocument);
  documents.recovered.set(beforeDocument, successor);
  await expect
    .poll(
      async () =>
        (await host(request)).reloads
          .slice(before.reloads.length)
          .filter((event) => event.environment === "ssr"),
      { timeout: 20_000 },
    )
    .not.toEqual([]);
  await expect.poll(async () => nonce(request), { timeout: 30_000 }).not.toBe(beforeNonce);
  const after = await host(request);
  expect(after.environments["rsc"]?.hash).toBe(before.environments["rsc"]?.hash);
  const log = (await readFile(hostLogFile, "utf8")).slice(offset);
  expect(log).toContain("[alchemy-runtime] restart reason=full-reload:ssr");
  expect(log).toContain("[alchemy-runtime] browser reload reason=full-reload:ssr");
  expect(log).toMatch(/\[alchemy-runtime\] ready generation=\d+/);
}

async function existingBrowserWorks(page: Page) {
  // Do not page.goto/reload here. The host may have sent its standard full reload,
  // but a browser left open across runtime replacement must work without our help.
  const button = page.getByRole("button", { name: /^Count: \d+$/ });
  await expect(button).toHaveAttribute("data-test-hydrated", "true", { timeout: 30_000 });
  const count = Number((await button.innerText()).match(/\d+$/)?.[0]);
  expect(Number.isFinite(count)).toBe(true);
  await button.click();
  await expect(
    page.getByRole("button", { name: `Count: ${count + 1}`, exact: true }),
  ).toBeVisible();
  const action = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
  expect((await action).status()).toBe(200);
  await expect(page.getByTestId("action-greeting")).toHaveText("Hello from Alchemy KV, Ada!");
}

function replaceCounter(source: string, label: string) {
  const updated = source.replace("Count:", `${label}:`);
  expect(updated).not.toBe(source);
  return updated;
}

// Network interruption is allowed only for an explicitly in-flight request during
// a proven optimizer restart. Timeouts and arbitrary errors are never success.
function interrupted(error: unknown) {
  expect(error).toBeInstanceOf(Error);
  const details =
    error instanceof Error ? `${error.message} ${String(error.cause)}` : String(error);
  expect(details).toMatch(/socket|ECONNRESET|other side closed|terminated/i);
  expect(details).not.toMatch(/timeout|aborted/i);
  return "interrupted" as const;
}

async function healthySince(offset: number) {
  const log = await readFile(hostLogFile, "utf8");
  expect(log).not.toContain("[alchemy-runtime] failed:");
  expect(log.slice(offset)).not.toMatch(
    /ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR|ERR_OUTDATED_OPTIMIZED_DEP|Effront.*same instance|Failed to reload the Worker runtime/,
  );
}

test(
  warm
    ? "warm cached startup distinguishes accepted updates from server full reloads"
    : "cold workerd recovers from two optimizer reloads without replay and preserves accepted HMR",
  async ({ page, request, baseURL }) => {
    test.setTimeout(180_000);
    const originalCounter = await readFile(counterFile, "utf8");
    const originalDependency = await readFile(dependencyFile, "utf8");
    const browserErrors: string[] = [];
    const documents: DocumentTransitions = { active: new Set(), recovered: new Map() };
    const routeDiagnostics: Array<{ origin: number | null; active: boolean; message: string }> = [];
    await page.addInitScript(() => {
      const original = console.error;
      console.error = (...args: unknown[]) => {
        original.call(console, `[document:${performance.timeOrigin}]`, ...args);
      };
    });
    let restarting = false;
    page.on("pageerror", (error) => {
      if (
        restarting &&
        /^(Failed to fetch|Load failed|Failed to fetch dynamically imported module)/.test(
          error.message,
        )
      )
        return;
      browserErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (message.text().includes("RouteOutlet rendered outside its route node")) {
        const match = message.text().match(/^\[document:([\d.]+)\]/);
        const origin = match ? Number(match[1]) : null;
        routeDiagnostics.push({
          origin,
          active: restarting && origin !== null && documents.active.has(origin),
          message: message.text(),
        });
        return;
      }
      if (
        restarting &&
        /Failed to load resource.*(?:502|503)|net::ERR_(?:CONNECTION_RESET|EMPTY_RESPONSE|ABORTED)/.test(
          message.text(),
        )
      )
        return;
      browserErrors.push(message.text());
    });

    try {
      await applicationWorks(page, request);
      const initialHost = await host(request);
      if (warm) {
        const cached = JSON.parse(await readFile(join(packageRoot, "tmp/warm-cache.json"), "utf8"));
        expect(initialHost.environments["rsc"]?.hash).toBe(cached.browserHash);
      }
      for (const environment of ["rsc", "ssr"]) {
        expect(initialHost.environments[environment]?.noDiscovery).toBe(false);
      }
      expect(initialHost.environments["rsc"]?.include).toEqual(
        expect.arrayContaining(["@effront-test/optimizer-a"]),
      );
      expect(initialHost.environments["rsc"]?.include.some((id) => id.includes("react"))).toBe(
        true,
      );
      const persisted = crypto.randomUUID();
      expect((await request.post(`/__test/kv?id=${persisted}`, { maxRetries: 0 })).status()).toBe(
        200,
      );

      // Server full reload replaces the worker and browser document.
      await page.getByRole("button", { name: "Count: 0", exact: true }).click();
      await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
      restarting = true;
      await sourceFullReload(
        page,
        request,
        replaceCounter(originalCounter, "Source HMR"),
        "Source HMR",
        documents,
      );
      await sourceFullReload(page, request, originalCounter, "Count", documents);
      restarting = false;
      // Maintained regression: ordinary server full reload must not leave stale
      // Flight client-reference URLs that break a newly hydrated route tree.
      await applicationWorks(page, request);

      if (!warm) {
        // These two transitions are one repeated-recovery lifecycle contract. Each
        // request has a distinct ID, and each transition must actually re-optimize.
        for (const [index, dependency, value] of [
          [1, "optimizer-b", "one"],
          [2, "optimizer-c", "two"],
        ] as const) {
          const before = await host(request);
          const beforeNonce = await nonce(request);
          const beforeLog = (await readFile(hostLogFile, "utf8")).length;
          const beforeDocument = await page.evaluate(() => performance.timeOrigin);
          const id = `inflight-${index}-${crypto.randomUUID()}`;
          const inflight = fetch(`${baseURL}/__test/inflight?id=${id}`, {
            method: "POST",
            signal: AbortSignal.timeout(45_000),
          }).then(async (response) => {
            expect([502, 503]).toContain(response.status);
            await response.text();
            return "interrupted" as const;
          }, interrupted);
          await expect
            .poll(async () => (await host(request)).ledger[id], { timeout: 15_000 })
            .toBe(1);
          const stream = await fetch(`${baseURL}/__test/stream`, {
            signal: AbortSignal.timeout(45_000),
          });
          expect(stream.status).toBe(200);
          const reader = stream.body!.getReader();
          expect(new TextDecoder().decode((await reader.read()).value)).toBe(`${beforeNonce}\n`);
          const streamClosed = (async () => {
            try {
              const next = await reader.read();
              expect(next.done).toBe(true);
            } catch (error) {
              interrupted(error);
            } finally {
              reader.releaseLock();
            }
          })();
          restarting = true;
          documents.active.add(beforeDocument);
          await writeFile(
            dependencyFile,
            `import { value } from "@effront-test/${dependency}";\nexport { value };\n`,
          );
          // Only this GET may be repeated: it is a recovery probe, never the mutation.
          await expect
            .poll(
              async () => {
                const response = await request
                  .get("/__test/dependency", { maxRetries: 0, timeout: 10_000 })
                  .catch((error: unknown) => {
                    interrupted(error);
                    return undefined;
                  });
                if (!response) return "restarting";
                if ([502, 503, 504].includes(response.status())) return "restarting";
                expect(response.status()).toBe(200);
                return (await response.json()).value;
              },
              { timeout: 45_000 },
            )
            .toBe(value);
          await expect.poll(async () => nonce(request), { timeout: 30_000 }).not.toBe(beforeNonce);
          const after = await host(request);
          expect(after.environments["rsc"]?.hash).not.toBe(before.environments["rsc"]?.hash);
          expect(after.reloads.slice(before.reloads.length)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                environment: "rsc",
                hash: after.environments["rsc"]?.hash,
              }),
            ]),
          );
          const transitionLog = (await readFile(hostLogFile, "utf8")).slice(beforeLog);
          expect(transitionLog).toContain("optimized dependencies changed. reloading");
          expect(transitionLog).toContain("[alchemy-runtime] restart reason=optimizer:");
          // One scheduler cycle may coalesce source full reload and optimizer dirtiness.
          // Its browser navigation starts once, while all worker generations drain.
          expect(transitionLog).toMatch(
            /\[alchemy-runtime\] browser reload reason=(?:optimizer|full-reload):rsc/,
          );
          expect(transitionLog).toMatch(/\[alchemy-runtime\] ready generation=\d+/);
          await expect(inflight).resolves.toBe("interrupted");
          await streamClosed;
          expect((await host(request)).ledger[id]).toBe(1);
          const successor = await automaticDocumentRecovery(page, beforeDocument, "Count");
          documents.active.delete(beforeDocument);
          documents.recovered.set(beforeDocument, successor);
          const healthyOffset = (await readFile(hostLogFile, "utf8")).length;
          restarting = false;
          await existingBrowserWorks(page);
          await applicationWorks(page, request);
          expect((await request.get(`/__test/kv?id=${persisted}`)).status()).toBe(200);
          await expect
            .poll(
              async () => (await (await request.get(`/__test/kv?id=${persisted}`)).json()).value,
            )
            .toBe(persisted);
          expect((await host(request)).ledger[id]).toBe(1);
          await healthySince(healthyOffset);
        }
      }
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toHaveAttribute(
        "data-test-hydrated",
        "true",
        { timeout: 30_000 },
      );
      await page.getByRole("button", { name: "Count: 0", exact: true }).click();
      await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
      restarting = true;
      await sourceFullReload(
        page,
        request,
        replaceCounter(originalCounter, "Final source HMR"),
        "Final source HMR",
        documents,
      );
      await sourceFullReload(page, request, originalCounter, "Count", documents);
      restarting = false;
      await applicationWorks(page, request);
      // Independent final phase: accepted client updates preserve this live document.
      // Known limitation: Tailwind updates accompanying this edit can break a later
      // fresh hydration. This test does not claim that combination is repaired.
      await page.getByRole("button", { name: "Count: 0", exact: true }).click();
      await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
      await acceptedUpdateWorks(page, request);
      await existingBrowserWorks(page);
      expect(
        routeDiagnostics.filter(
          (diagnostic) =>
            !diagnostic.active ||
            diagnostic.origin === null ||
            !documents.recovered.has(diagnostic.origin),
        ),
      ).toEqual([]);
      expect(browserErrors).toEqual([]);
      expect(await readFile(hostLogFile, "utf8")).not.toContain("[alchemy-runtime] failed:");
    } finally {
      await test.info().attach("restart-diagnostics", {
        body: JSON.stringify(
          {
            diagnostics: routeDiagnostics,
            recoveredOrigins: [...documents.recovered],
            remainingActiveOrigins: [...documents.active],
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
      await test.info().attach("browser-errors", {
        body: JSON.stringify(browserErrors, null, 2),
        contentType: "application/json",
      });
      await writeFile(counterFile, originalCounter);
      await writeFile(dependencyFile, originalDependency);
    }
  },
);
