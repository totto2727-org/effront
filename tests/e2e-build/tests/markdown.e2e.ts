import { readFile } from "node:fs/promises";
import { expect, test as base } from "@playwright/test";

const unicodePath = `/manual/guide/${encodeURIComponent("日本語 space")}`;
const destinations = [
  { path: "/manual/guide/getting-started", title: "Getting started", hash: "installation" },
  { path: "/manual/guide/deep/details", title: "Deep details", hash: undefined },
  { path: unicodePath, title: "Unicode page", hash: "details" },
];

type FlightClientReference = { moduleId: string; exportName: string };

const flightClientReferences = (body: string): FlightClientReference[] => {
  const strings = new Map(
    [...body.matchAll(/^([0-9a-f]+):"((?:\\.|[^"\\])*)"$/gm)].map((match) => [
      match[1]!,
      JSON.parse(`"${match[2]!}"`) as string,
    ]),
  );
  return [...body.matchAll(/^[0-9a-f]+:I(\[.*\])$/gm)].flatMap((match) => {
    const value: unknown = JSON.parse(match[1]!);
    if (!Array.isArray(value) || typeof value[0] !== "string" || typeof value[2] !== "string")
      return [];
    const exportName = value[2].startsWith("$")
      ? (strings.get(value[2].slice(1)) ?? value[2])
      : value[2];
    return [{ moduleId: value[0], exportName }];
  });
};

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (!baseURL) throw new TypeError("Markdown acceptance requires a local host baseURL");
    const errors: string[] = [];
    const remoteRequests: string[] = [];
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL).origin) {
        remoteRequests.push(url.href);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/hydrat|server rendered html|did not match/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    await use(page);
    expect(errors, "No browser exceptions or React hydration faults").toEqual([]);
    expect(
      remoteRequests.filter((url) => !url.startsWith("https://fonts.googleapis.com/")),
      "Only upstream Mermaid's Google Fonts import may be blocked by local acceptance policy",
    ).toEqual([]);
  },
});

test.describe("Markdown without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders default Markdown plugins in the original server document", async ({ page }) => {
    const response = await page.goto("/manual");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"]).toContain("text/html");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markdown manual");
    await expect(page.getByRole("heading", { name: "Features", exact: true })).toHaveAttribute(
      "id",
      "features",
    );
    await expect(page.locator(".footnotes")).toBeVisible();
    await expect(page.locator(".footnotes")).toContainText("Footnote detail");
    const footnote = page.locator('sup a[href^="#"]').first();
    await expect(footnote).toBeVisible();
    const footnoteHref = await footnote.getAttribute("href");
    if (!footnoteHref) throw new Error("A footnote must link to its rendered definition");
    await expect(page.locator(`[id=${JSON.stringify(footnoteHref.slice(1))}]`)).toContainText(
      "Footnote detail",
    );
    await footnote.click();
    await expect.poll(() => new URL(page.url()).hash).toBe(footnoteHref);

    // The configured document boundary is client-only: without JavaScript its documented
    // loading states are present, but no browser-only KaTeX or Mermaid output is emitted.
    await expect(page.getByTestId("markdown-heading-override")).toHaveText("Markdown manual");
    await expect(page.locator(".math")).toHaveText(["...", "...", "..."]);
    const mermaid = page.locator(".mermaid");
    await expect(mermaid).toHaveCount(3);
    await expect(mermaid).toHaveText(["", "", ""]);
    await expect(page.locator(".katex, .mermaid svg")).toHaveCount(0);
    const code = page.locator("pre.shiki").first();
    await expect(code).toBeVisible();
    await expect(code.locator("code")).toHaveText('const message: string = "Hello Markdown";');
    const tokenColors = await code
      .locator("code span[style]")
      .evaluateAll((tokens) => [...new Set(tokens.map((token) => getComputedStyle(token).color))]);
    expect(tokenColors.length, "Syntax colors apply without a browser highlighter").toBeGreaterThan(
      1,
    );
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(2);
    await expect(page.getByRole("checkbox").first()).toBeDisabled();
    await expect(page.getByRole("checkbox").first()).toBeChecked();
    await expect(page.getByRole("checkbox").last()).not.toBeChecked();
    await expect(page.locator('blockquote[as="note"]')).toContainText(
      "Markdown links point to source files, not hand-written website routes.",
    );
    expect(await page.locator("blockquote").allTextContents()).not.toContain("[!NOTE]");
    await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toBeVisible();
  });

  test("maps source references to public URLs while retaining suffixes and external URLs", async ({
    page,
  }) => {
    await page.goto("/manual");
    await expect(
      page.locator("main article").getByRole("link", { name: "Getting started", exact: true }),
    ).toHaveAttribute("href", "/manual/guide/getting-started?from=manual#installation");
    await expect(
      page.locator("main article").getByRole("link", { name: "Deep details", exact: true }),
    ).toHaveAttribute("href", "/manual/guide/deep/details");
    await expect(
      page.locator("main article").getByRole("link", { name: "Unicode page", exact: true }),
    ).toHaveAttribute("href", `${unicodePath}?from=manual#details`);
    await expect(
      page.locator("main article").getByRole("link", { name: "External reference", exact: true }),
    ).toHaveAttribute("href", "https://example.com/reference?q=markdown#section");
    const localSection = page
      .locator("main article")
      .getByRole("link", { name: "Local section", exact: true });
    await expect(localSection).toHaveAttribute("href", "#features");
    await localSection.click();
    await expect.poll(() => new URL(page.url()).hash).toBe("#features");
    await expect(page.locator("#features")).toBeInViewport();
    await page
      .locator("main article")
      .getByRole("link", { name: "Getting started", exact: true })
      .click();
    await expect(page).toHaveURL(/\/manual\/guide\/getting-started\?from=manual#installation$/);
    await expect(page.locator("#installation")).toBeVisible();
  });

  test("serves a source-linked image as real Vite asset bytes and a decoded browser image", async ({
    page,
    request,
  }) => {
    await page.goto("/manual");
    const image = page.getByRole("img", { name: "Markdown diagram", exact: true });
    await expect(image).toBeVisible();
    const src = await image.getAttribute("src");
    if (!src) throw new Error("The Markdown image must resolve to a public asset URL");
    expect(src).not.toMatch(/^(?:data:|file:)/);
    const asset = await request.get(new URL(src, page.url()).href);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toMatch(/^image\//);
    expect(await asset.body()).toEqual(
      await readFile(new URL("../fixture/content/manual/images/diagram.svg", import.meta.url)),
    );
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
      .toBe(true);
  });

  for (const destination of destinations) {
    test(`directly serves nested source page ${destination.title}`, async ({ page }) => {
      const response = await page.goto(destination.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(destination.title);
      if (destination.hash)
        await expect(page.locator(`[id=${JSON.stringify(destination.hash)}]`)).toBeVisible();
      await expect(
        page.locator("main article").getByRole("link", { name: "Manual home", exact: true }),
      ).toHaveAttribute("href", "/manual");
    });
  }
});

test("renders configured upstream math and diagrams after hydration", async ({ page, request }) => {
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("markdown-heading-override")).toHaveText("Markdown manual");
  await expect(page.locator(".math .katex")).toHaveCount(2);
  await expect(page.locator(".math").last()).toHaveText("...");
  await expect(page.locator(".mermaid svg")).toHaveCount(2);
  await expect(
    page.locator(".mermaid svg text").filter({ hasText: "marker-end=url(#arrowhead)" }),
  ).toHaveCount(1);
  await expect(page.locator(".mermaid").last()).toBeEmpty();
  await expect(page.locator(".mermaid").last()).toHaveAttribute("data-error", /.+/);

  await expect(page.locator(".footnotes")).toContainText("Footnote detail");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator('blockquote[as="note"]')).toContainText(
    "Markdown links point to source files, not hand-written website routes.",
  );
  const colors = await page
    .locator("pre.shiki code span[style]")
    .evaluateAll((tokens) => [...new Set(tokens.map((token) => getComputedStyle(token).color))]);
  expect(colors.length, "Server-produced Shiki colors remain visible").toBeGreaterThan(1);

  await expect
    .poll(() =>
      page.evaluate(async () => {
        await document.fonts.ready;
        return document.fonts.check("16px KaTeX_Main");
      }),
    )
    .toBe(true);
  const stylesheets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(
    stylesheets.length,
    "Production document CSS is linked from the built host",
  ).toBeGreaterThan(0);
  for (const href of stylesheets) {
    const stylesheet = await request.get(href);
    expect(stylesheet.status()).toBe(200);
  }

  const prose = await page
    .locator(".effront-markdown")
    .evaluate((element) => getComputedStyle(element).color);
  expect(prose).toBe("rgb(31, 41, 55)");
  await expect(page.locator(".mermaid svg style").first()).toContainText("fonts.googleapis.com");
});

test("keeps configured MarkdownDocument readable in dark mode and a narrow built host", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/manual");
  await page.locator("html").evaluate((element) => element.classList.add("dark"));
  await page.waitForLoadState("networkidle");

  await expect(page.locator(".math .katex").first()).toBeVisible();
  await expect(page.locator(".mermaid svg")).toHaveCount(2);
  await expect(page.locator(".effront-markdown")).toHaveCSS("color", "rgb(230, 237, 243)");
  const alertColors = await page
    .locator('blockquote[as="warning"], blockquote[as="caution"]')
    .evaluateAll((alerts) =>
      alerts.map((alert) => {
        const style = getComputedStyle(alert);
        return { background: style.backgroundColor, color: style.color };
      }),
    );
  expect(alertColors).toEqual([
    { background: "rgb(52, 26, 0)", color: "rgb(139, 148, 158)" },
    { background: "rgb(52, 26, 0)", color: "rgb(139, 148, 158)" },
  ]);
  const contrast = (foreground: [number, number, number], background: [number, number, number]) => {
    const luminance = (color: [number, number, number]) =>
      color
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  expect(
    contrast([139, 148, 158], [52, 26, 0]),
    "Dark warning and caution text meets WCAG AA",
  ).toBeGreaterThanOrEqual(4.5);
  const viewportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(viewportOverflow, "Document styles constrain wide math, diagrams, tables, and code").toBe(
    true,
  );
});

test("keeps a document with server-only rich overrides out of Math and Mermaid client references", async ({
  page,
  request,
}) => {
  const html = await request.get("/manual-server-only", { headers: { Accept: "text/html" } });
  expect(html.status()).toBe(200);
  const htmlBody = await html.text();
  expect(htmlBody).toContain('data-testid="server-only-markdown"');
  expect(htmlBody).toMatch(/Server math: (?:<!-- -->)?E = mc\^2/);
  expect(htmlBody).toMatch(/Server diagram: (?:<!-- -->)?flowchart LR/);
  expect(htmlBody).not.toMatch(/class="(?:math|mermaid)\b|class="katex\b/);

  const normalFlight = await request.get("/manual", { headers: { Accept: "text/x-component" } });
  expect(normalFlight.status()).toBe(200);
  expect(normalFlight.headers()["content-type"]).toContain("text/x-component");
  const richReferences = flightClientReferences(await normalFlight.text()).filter((reference) =>
    /^(?:Markdown)?(?:Math|Mermaid)$/.test(reference.exportName),
  );
  expect(
    richReferences.map((reference) => reference.exportName.replace(/^Markdown/, "")).sort(),
  ).toEqual(["Math", "Mermaid"]);
  const richModuleIds = new Set(richReferences.map((reference) => reference.moduleId));

  const flight = await request.get("/manual-server-only", {
    headers: { Accept: "text/x-component" },
  });
  expect(flight.status()).toBe(200);
  expect(flight.headers()["content-type"]).toContain("text/x-component");
  const flightBody = await flight.text();
  expect(flightBody).toMatch(/Server math:[\s\S]{0,30}E = mc\^2/);
  expect(flightBody).toMatch(/Server diagram:[\s\S]{0,30}flowchart LR/);
  expect(flightBody).not.toMatch(
    /(?:MarkdownMath|MarkdownMermaid|@comark\/react\/components\/(?:Math|Mermaid)|beautiful-mermaid)/i,
  );
  const serverReferences = flightClientReferences(flightBody);
  expect(
    serverReferences,
    "The server-only route still includes shared client shell references",
  ).not.toEqual([]);
  expect(
    serverReferences.filter((reference) =>
      /^(?:Markdown)?(?:Math|Mermaid)$/.test(reference.exportName),
    ),
    "Server-only overrides do not register rich client exports",
  ).toEqual([]);
  expect(
    serverReferences.filter((reference) => richModuleIds.has(reference.moduleId)),
    "Server-only overrides do not retain the normal rich client module IDs",
  ).toEqual([]);

  await page.goto("/manual-server-only");
  await expect(page.getByTestId("server-math")).toHaveCount(3);
  await expect(page.getByTestId("server-mermaid")).toHaveCount(3);
  await expect(
    page.locator(
      "[data-testid=server-only-markdown] .katex, [data-testid=server-only-markdown] .mermaid",
    ),
  ).toHaveCount(0);
});

for (const destination of [{ path: "/manual", title: "Markdown manual" }, ...destinations]) {
  test(`negotiates native Flight for ${destination.title}`, async ({ request }) => {
    const response = await request.get(destination.path, {
      headers: { Accept: "text/x-component" },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/x-component");
    expect(response.headers()["vary"]).toContain("Accept");
    const body = await response.text();
    expect(body).toContain(destination.title);
    expect(body).not.toMatch(/<!doctype html/i);
    expect(body).not.toMatch(/"digest":/);
  });
}

for (const accept of ["text/html", "text/x-component"]) {
  test(`returns 404 for unknown nested Markdown content with ${accept}`, async ({ request }) => {
    const response = await request.get("/manual/guide/deep/unknown", {
      headers: { Accept: accept },
    });
    expect(response.status()).toBe(404);
  });

  test(`returns 404 for unindexed URL segments without aliasing Markdown content with ${accept}`, async ({
    request,
  }) => {
    for (const path of [
      "/manual/guide/%",
      "/manual/guide/%E0%A4%A",
      "/manual/guide%2Fdeep/details",
      "/manual/guide%5Cdeep/details",
      "/manual/guide/deep/details%00",
      "/manual/guide//deep/details",
      "/manual/guide%252Fdeep/details",
    ]) {
      const response = await request.get(path, { headers: { Accept: accept } });
      expect(
        response.status(),
        `No indexed document for ${path}, without aliasing or throwing`,
      ).toBe(404);
      expect(await response.text()).not.toContain("Deep details");
    }
  });
}

test("hydrates and follows Markdown links with Flight while retaining shared layout state", async ({
  page,
  request,
}) => {
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documentRequests.push(request.url());
  });

  for (const destination of destinations) {
    let flightContent: Promise<string> | undefined;
    const flightPromise = page.waitForResponse((response) => {
      const matches =
        new URL(response.url()).pathname === destination.path &&
        response.headers()["content-type"]?.includes("text/x-component") === true;
      if (matches) flightContent = response.text();
      return matches;
    });
    await page
      .locator("main article")
      .getByRole("link", { name: destination.title, exact: true })
      .click();
    const flight = await flightPromise;
    expect(flight.status()).toBe(200);
    expect(flight.headers()["content-type"]).toContain("text/x-component");
    expect(
      flightContent,
      "The matched native Flight response starts reading before navigation",
    ).toBeDefined();
    expect(await flightContent).toContain(destination.title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(destination.title);
    const url = new URL(page.url());
    expect(url.pathname).toBe(destination.path);
    if (destination.hash) {
      expect(url.search).toBe("?from=manual");
      expect(url.hash).toBe(`#${destination.hash}`);
      await expect(page.locator(`[id=${JSON.stringify(destination.hash)}]`)).toBeInViewport();
    }
    await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markdown manual");
    await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  }
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unicode page");
  await page
    .locator("main article")
    .getByRole("link", { name: "Manual home", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markdown manual");
  await page.getByRole("button", { name: "Count: 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 2", exact: true })).toBeVisible();
  await expect(page.locator(".math .katex")).toHaveCount(2);
  await expect(page.locator(".mermaid svg")).toHaveCount(2);
  expect(documentRequests, "Markdown and history navigation must not reload the document").toEqual(
    [],
  );
});

test("keeps Markdown parsing and Shiki out of the actual browser build while including renderers", async ({
  request,
}) => {
  const response = await request.get("/acceptance-client-graph.json");
  expect(response.status()).toBe(200);
  const graph: { modules: string[]; assets: string[] } = await response.json();
  expect(graph.modules.length, "Audit a real nonempty client build").toBeGreaterThan(10);
  expect(graph.modules.some((id) => id.includes("/e2e-build/fixture/src/"))).toBe(true);
  const implementation = graph.modules;
  expect(
    implementation.filter((id) => /(?:^|\/)node_modules\/(?:katex|beautiful-mermaid)\//.test(id)),
    "Configured KaTeX and Mermaid runtime implementations are present in the browser build",
  ).toHaveLength(2);
  expect(
    implementation.filter((id) =>
      /packages\/markdown\/(?:src|dist)\/(?:math|mermaid)\.(?:[jt]sx?)/.test(id),
    ),
    "The Mermaid client wrapper is isolated while the Math re-export is optimized away",
  ).toHaveLength(1);
  expect(
    implementation.filter((id) =>
      /packages\/markdown\/(?:src|dist)\/(?:document|index|parse)\.(?:[jt]sx?)/.test(id),
    ),
    "The parsed document renderer remains in the RSC graph",
  ).toEqual([]);
  expect(
    implementation.filter((id) =>
      /(?:^|\/)node_modules\/@comark\/react\/dist\/components\/(?:Math|Mermaid)\.js/.test(id),
    ),
    "Configured upstream Math and Mermaid leaves are present in the browser build",
  ).toHaveLength(2);
  expect(
    implementation.filter((id) =>
      /(?:^|\/)node_modules\/@comark\/react\/(?:dist\/(?:index|components\/MarkdownDocument)|index)/.test(
        id,
      ),
    ),
    "Comark's document renderer is not clientified",
  ).toEqual([]);
  expect(
    implementation.filter((id) =>
      /(?:^|\/)node_modules\/(?:comark|shiki|oniguruma|vscode-textmate|markdown-it|micromark)\//.test(
        id,
      ),
    ),
    "No browser Markdown parser or syntax-highlighting implementation",
  ).toEqual([]);
});
