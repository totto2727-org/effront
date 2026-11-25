import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

import { docsTest as test } from "./docs-host.fixture.ts";
import { flightClientReferences } from "./markdown-references.fixture.ts";

const serverOnlyPath = "/manual-server-only";
const httpStatusOk = 200;
const expectedOverrideCount = 3;
const absentElementCount = 0;

const readFlightBody = async (request: APIRequestContext, path: string): Promise<string> => {
  const response = await request.get(path, { headers: { Accept: "text/x-component" } });
  expect(response.status()).toBe(httpStatusOk);
  expect(response.headers()["content-type"]).toContain("text/x-component");
  return response.text();
};

const expectServerOnlyHtml = async (request: APIRequestContext): Promise<void> => {
  const html = await request.get(serverOnlyPath, { headers: { Accept: "text/html" } });
  expect(html.status()).toBe(httpStatusOk);
  const htmlBody = await html.text();
  expect(htmlBody).toContain('data-testid="server-only-markdown"');
  expect(htmlBody).toMatch(/Server math: (?:<!-- -->)?E = mc\^2/u);
  expect(htmlBody).toMatch(/Server diagram: (?:<!-- -->)?flowchart LR/u);
  expect(htmlBody).not.toMatch(/class="(?:math|mermaid)\b|class="katex\b/u);
};

const readRichClientIds = async (request: APIRequestContext): Promise<Set<string>> => {
  const body = await readFlightBody(request, "/manual");
  const rich = flightClientReferences(body).filter(({ exportName }) =>
    /^(?:Math|Mermaid)$/u.test(exportName),
  );
  expect(rich.map(({ exportName }) => exportName).toSorted()).toEqual(["Math", "Mermaid"]);
  return new Set(rich.map(({ moduleId }) => moduleId));
};

const expectServerOnlyFlight = async (request: APIRequestContext): Promise<void> => {
  const normalIds = await readRichClientIds(request);
  const flight = await readFlightBody(request, serverOnlyPath);
  expect(flight).toMatch(/Server math:[\s\S]{0,30}E = mc\^2/u);
  expect(flight).toMatch(/Server diagram:[\s\S]{0,30}flowchart LR/u);
  expect(flight).not.toMatch(
    /(?:MarkdownMath|MarkdownMermaid|@comark\/react\/components\/(?:Math|Mermaid)|beautiful-mermaid)/iu,
  );
  const references = flightClientReferences(flight);
  expect(
    references,
    "The server-only route still includes shared client shell references",
  ).not.toEqual([]);
  const richExports = references.filter(({ exportName }) =>
    /^(?:Markdown)?(?:Math|Mermaid)$/u.test(exportName),
  );
  expect(richExports, "Server-only overrides do not register rich client exports").toEqual([]);
  expect(
    references.filter(({ moduleId }) => normalIds.has(moduleId)),
    "Server-only overrides do not retain the normal rich client module IDs",
  ).toEqual([]);
};

const expectServerOnlyBrowser = async (page: Page): Promise<void> => {
  await page.goto(serverOnlyPath);
  await expect(page.getByTestId("server-math")).toHaveCount(expectedOverrideCount);
  await expect(page.getByTestId("server-mermaid")).toHaveCount(expectedOverrideCount);
  const markdown = page.getByTestId("server-only-markdown");
  await expect(markdown.locator(".katex, .mermaid")).toHaveCount(absentElementCount);
};

test("keeps a document with server-only rich overrides out of Math and Mermaid client references", async ({
  page,
  request,
}) => {
  await expectServerOnlyHtml(request);
  await expectServerOnlyFlight(request);
  await expectServerOnlyBrowser(page);
});
