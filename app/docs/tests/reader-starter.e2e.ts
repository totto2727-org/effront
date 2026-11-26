import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { Reader } from "./reader-journey.browser.fixture.ts";
import {
  expectFileRows,
  expectSyntaxColors,
  followHeading,
  openGuide,
  readers,
} from "./reader-journey.browser.fixture.ts";

const baseFiles = ["src/entry.effront.tsx", "vite.config.ts", "package.json"];
const starterFiles = [
  "src/entry.effront.tsx",
  "src/entry.rsc.ts",
  "src/entry.server.ts",
  "vite.config.ts",
  "package.json",
];
const hosts = [
  { example: "node", host: "node" },
  { example: "bun", host: "bun" },
  { example: "cloudflare", host: "cloudflare" },
  { example: "alchemy-cloudflare", host: "alchemy" },
] as const;
type Host = (typeof hosts)[number];

const expectStarterCommands = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "setup");
  const commands = page.locator("article pre code").filter({ hasText: "vp create effront" });
  await expect(commands).toHaveText(
    "vp create effront -- my-app --platform node\ncd my-app\nvp install\nvp dev",
  );
  await expect(
    page.locator(
      'article a[href="https://github.com/totto2727-org/effront/blob/main/examples/node/src/entry.effront.tsx"]',
    ),
  ).toBeVisible();
  await followHeading(page, reader, "application");
  await expectFileRows(page, starterFiles);
};

const expectStartingEdit = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "run");
  const headingEdit = page.locator('article pre[data-language="tsx"] code');
  await expect(headingEdit).toContainText("const HomePage = EFFRONT.Page.make({");
  await expect(headingEdit).toContainText("render: () => Effect.succeed(<h1>Hello, Effront</h1>),");
  await expectSyntaxColors(headingEdit);
};

const expectHostSetup = async (
  page: Page,
  reader: Reader,
  { example, host }: Host,
): Promise<void> => {
  await followHeading(page, reader, "setup");
  const commands = page.locator("article pre code").filter({ hasText: "vp create effront" });
  await expect(commands).toContainText(`vp create effront -- my-app --platform ${example}`);
  await expect(commands).toContainText("cd my-app");
  await expect(commands).toContainText("vp install");
  const article = page.locator("article");
  await Promise.all(
    ["git clone", "vp pack", "Count: 0", "cd examples/workers"].map(async (text) =>
      expect(article).not.toContainText(text),
    ),
  );
  const tool = host === "alchemy" ? "Alchemy" : "Vite";
  await expect(article).toContainText(
    reader.locale === "en" ? `local URL printed by ${tool}` : `${tool} が表示するローカル URL`,
  );
  await expectFileRows(page, baseFiles);
};

const expectWorkersContext = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "context");
  const context = page.locator("article pre code").filter({ hasText: "readRequestSettings" });
  await expect(context).toContainText('from "@effront/cloudflare/workers"');
  await expect(context).toContainText("yield* getWorkersEnv<Env>()");
  await expect(context).toContainText("yield* getWorkersRequestContext<Env>()");
  await expect(context).toContainText("executionContext.waitUntil(recordAccess(path))");
  await expect(page.locator("article")).not.toContainText("My Effront App");
};

const expectWorkersFactory = async (page: Page): Promise<void> => {
  const factory = page
    .locator("article pre code")
    .filter({ hasText: "createWorkersContextAccessors<Env>()" });
  await expect(factory).toContainText("const workers = createWorkersContextAccessors<Env>()");
  await expect(factory).toContainText("yield* workers.getWorkersEnv()");
  await expect(factory).toContainText("yield* workers.getWorkersRequestContext()");
  await expectSyntaxColors(factory);
};

const expectCloudflareHost = async (page: Page, reader: Reader): Promise<void> => {
  await followHeading(page, reader, "local");
  await expect(page.locator("article")).not.toContainText("vp preview");
  await expect(
    page.locator("article pre code").filter({ hasText: "vp exec wrangler dev" }),
  ).toHaveText(
    "vp build\nvp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787",
  );
  await expect(page.locator('article a[href="http://127.0.0.1:8787"]')).toBeVisible();
  await expectWorkersContext(page, reader);
  await expectWorkersFactory(page);
};

const checkNativeTranslation = async (
  page: Page,
  reader: Reader,
  host: "node" | "bun",
): Promise<void> => {
  const other = reader.locale === "en" ? "ja" : "en";
  await page.locator(`a[hreflang="${other}"]`).click();
  await expect(page).toHaveURL(`/${other}/platforms/${host}`);
  await expect(page.locator("html")).toHaveAttribute("lang", other);
};

const expectNativeHost = async (
  page: Page,
  reader: Reader,
  host: "node" | "bun",
): Promise<void> => {
  const article = page.locator("article");
  await expect(article).not.toContainText(`examples/${host}`);
  await expect(article).toContainText(
    reader.locale === "en"
      ? "After the build, run from the generated project"
      : "ビルド後、生成したプロジェクトで次を実行します",
  );
  await expect(article).not.toContainText("vp preview");
  await expect(page.locator("article pre code").filter({ hasText: /^vp build$/u })).toBeVisible();
  await followHeading(page, reader, host);
  await expect(
    page.locator("article pre code").filter({ hasText: /^vp run start$/u }),
  ).toBeVisible();
  await expect(article).toContainText(`${host} dist/rsc/server.js`);
  await expect(page.locator('article a[href="http://127.0.0.1:3000"]')).toBeVisible();
  await checkNativeTranslation(page, reader, host);
};

const openHost = async (page: Page, reader: Reader, host: Host["host"]): Promise<void> => {
  await page.goto(`/${reader.locale}/platforms`);
  const href = `/${reader.locale}/platforms/${host}`;
  await page.locator(`article a[href="${href}"]`).click();
  await expect(page).toHaveURL(href);
};

readers.forEach((reader) => {
  test(`${reader.locale} reader finds the create-and-run starter and its file roles`, async ({
    page,
  }) => {
    await openGuide(page, reader, "/guide/getting-started");
    await expectStarterCommands(page, reader);
    await expectStartingEdit(page, reader);
  });

  hosts.forEach((host) => {
    test(`${reader.locale} reader creates the ${host.host} starter without assembling host configuration`, async ({
      page,
    }) => {
      await openHost(page, reader, host.host);
      await expectHostSetup(page, reader, host);
      if (host.host === "cloudflare") {
        await expectCloudflareHost(page, reader);
      }
      if (host.host === "node" || host.host === "bun") {
        await expectNativeHost(page, reader, host.host);
      }
    });
  });
});
