import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const appRoot = fileURLToPath(new URL("../../examples/alchemy/", import.meta.url));
const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const counterFile = join(appRoot, "src/components/counter.tsx");
const greetingServerFile = join(appRoot, "src/features/greeting/server.ts");
const hostLogFile = join(packageRoot, "tmp/host.log");

const hostFailurePatterns = [
  /ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR/,
  /ERR_OUTDATED_OPTIMIZED_DEP/,
  /\b(?:worker|entry)\b.*\b(?:failed|failure|error)\b/i,
  /\b(?:failed|failure|error)\b.*\b(?:worker|entry)\b/i,
  /\bfetch\b.*\b(?:failed|failure|error)\b/i,
  /\b(?:failed|failure|error)\b.*\bfetch\b/i,
];

async function hostErrors() {
  const log = await readFile(hostLogFile, "utf8");
  return hostFailurePatterns.flatMap((pattern) => log.match(pattern)?.[0] ?? []);
}

async function expectHealthyHost() {
  const errors = await hostErrors();
  expect(
    errors,
    "The real Vite and workerd logs must remain free of optimizer and worker failures",
  ).toEqual([]);
}

function counterWithLabel(original: Buffer, label: string) {
  const source = original.toString();
  const updated = source.replace("Count:", `${label}:`);
  expect(updated).not.toBe(source);
  return Buffer.from(updated);
}

function serverWithDependencies(original: Buffer, dependencies: readonly string[], marker: string) {
  const source = original.toString();
  const directive = '"use server";';
  const index = source.indexOf(directive);
  const imports = dependencies.map((dependency) => `import "${dependency}";`).join("\n");
  const updated = `${source.slice(0, index + directive.length)}\n\n${imports}${source.slice(
    index + directive.length,
  )}`.replace(
    "return `${host.greeting}, ${name}!`;",
    "return `${host.greeting}, ${name}! " + marker + "`;",
  );
  expect(index).toBeGreaterThanOrEqual(0);
  expect(updated).not.toBe(source);
  return Buffer.from(updated);
}

test("cold real workerd development startup survives dependency additions and repeated HMR", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const counterOriginal = await readFile(counterFile);
  const greetingServerOriginal = await readFile(greetingServerFile);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  try {
    // The Playwright webServer readiness request has already exercised this test-owned empty cache.
    await expectHealthyHost();
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Hello from Alchemy KV");
    const head = await request.head("/");
    expect(head.status()).toBe(200);
    expect(await head.body()).toHaveLength(0);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("kv-greeting")).toHaveText("Hello from Alchemy KV");
    await page.getByRole("button", { name: "Count: 0", exact: true }).click();
    await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();

    await writeFile(counterFile, counterWithLabel(counterOriginal, "Count after first HMR"));
    await expect(
      page.getByRole("button", { name: "Count after first HMR: 1", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expectHealthyHost();

    // The marker comes from the reloaded Server Function, so its successful response proves the Graph addition was evaluated.
    await writeFile(
      greetingServerFile,
      serverWithDependencies(greetingServerOriginal, ["effect/Graph"], "[Graph]"),
    );
    await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
    await expect(page.getByTestId("action-greeting")).toHaveText(
      "Hello from Alchemy KV, Ada! [Graph]",
    );
    await expectHealthyHost();

    // A second dependency addition and response marker prove Brand is evaluated before success.
    await writeFile(
      greetingServerFile,
      serverWithDependencies(
        greetingServerOriginal,
        ["effect/Graph", "effect/Brand"],
        "[Graph, Brand]",
      ),
    );
    await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
    await expect(page.getByTestId("action-greeting")).toHaveText(
      "Hello from Alchemy KV, Ada! [Graph, Brand]",
    );
    await expectHealthyHost();

    await writeFile(counterFile, counterWithLabel(counterOriginal, "Count after final HMR"));
    await expect(
      page.getByRole("button", { name: "Count after final HMR: 1", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: "About", exact: true }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByTestId("label")).toHaveText("Effront + Alchemy");
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectHealthyHost();
    expect(browserErrors, "Repeated HMR must not cause browser-side failures").toEqual([]);
  } finally {
    await Promise.all([
      writeFile(counterFile, counterOriginal),
      writeFile(greetingServerFile, greetingServerOriginal),
    ]);
    expect(await readFile(counterFile)).toEqual(counterOriginal);
    expect(await readFile(greetingServerFile)).toEqual(greetingServerOriginal);
  }
});
