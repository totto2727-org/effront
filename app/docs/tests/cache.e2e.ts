import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { buildHeaders } from "./cache-headers";

// These probes go through the built Alchemy Worker and workerd's real Cache API.
// A fresh build ID isolates each run from persistent local cache data.
for (const locale of ["en", "ja"]) {
  for (const accept of ["text/html", "text/x-component"]) {
    test(`edge cache reuses complete ${locale} ${accept} bytes`, async ({ request }) => {
      const headers = { ...(await buildHeaders(request)), Accept: accept };
      const path = `/${locale}/guide/markdown?cache-contract=bytes`;
      const first = await request.get(path, { headers });
      expect(first.status()).toBe(200);
      expect(first.headers()["x-effront-cache"]).toBe("MISS");
      expect(first.headers()["content-type"]).toContain(accept);
      expect(first.headers()["cache-control"]).toContain("max-age=0");
      expect(first.headers()["cache-control"]).toContain("must-revalidate");
      expect(first.headers()["vary"]?.toLowerCase()).toContain("accept");
      const bytes = await first.body();
      expect(bytes.length).toBeGreaterThan(100);

      await expect
        .poll(async () => {
          const response = await request.get(path, { headers });
          expect(response.headers()["content-type"]).toContain(accept);
          expect(await response.body()).toEqual(bytes);
          return response.headers()["x-effront-cache"];
        })
        .toBe("HIT");
    });
  }
}

test("alternating HTML, Flight and locales cannot reuse the other representation", async ({
  request,
}) => {
  const token = await buildHeaders(request);
  const variants = [
    { locale: "en", accept: "text/html" },
    { locale: "ja", accept: "text/x-component" },
    { locale: "en", accept: "text/x-component" },
    { locale: "ja", accept: "text/html" },
  ];
  const bodies = new Map<string, string>();
  for (const round of [0, 1]) {
    for (const { locale, accept } of variants) {
      const key = `${locale}:${accept}`;
      const response = await request.get(
        `/${locale}/guide/getting-started?cache-contract=alternating`,
        {
          headers: { ...token, Accept: accept },
        },
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain(accept);
      const body = await response.text();
      // Both formats contain locale-specific route metadata, not just translated prose.
      expect(body).toContain(`/${locale}/guide/getting-started`);
      if (accept === "text/html") expect(body).toContain(`lang="${locale}"`);
      if (round === 0) bodies.set(key, body);
      else expect(body).toBe(bodies.get(key));
    }
  }
  expect(bodies.get("en:text/html")).not.toBe(bodies.get("ja:text/html"));
  expect(bodies.get("en:text/x-component")).not.toBe(bodies.get("ja:text/x-component"));
});

test("query variants have separate edge entries", async ({ request }) => {
  const headers = { ...(await buildHeaders(request)), Accept: "text/html" };
  for (const query of ["one", "two"]) {
    const response = await request.get(`/en/guide/routes?cache-contract=query&value=${query}`, {
      headers,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["x-effront-cache"]).toBe("MISS");
    await response.body();
  }
});

for (const buildId of [undefined, "previous-deployment"]) {
  test(`Flight with ${buildId ?? "missing"} build token is rejected before cache lookup`, async ({
    request,
  }) => {
    const path = `/en/guide/markdown?cache-contract=guard-${buildId ?? "missing"}`;
    await request.get(path, {
      headers: { ...(await buildHeaders(request)), Accept: "text/x-component" },
    });
    const response = await request.get(path, {
      headers: {
        Accept: "text/x-component",
        ...(buildId ? { "x-effront-build-id": buildId } : {}),
      },
    });
    expect(response.status()).toBe(409);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(response.headers()["x-effront-cache"]).not.toBe("HIT");
    expect(response.headers()["content-type"]).toBeUndefined();
    expect(await response.body()).toHaveLength(0);
  });
}

for (const name of ["Cookie", "Authorization"]) {
  test(`private request bypasses a warmed public entry (${name})`, async ({ request }) => {
    const headers = { [name]: name === "Cookie" ? "session=private" : "Bearer private" };
    const path = "/en/guide/markdown?cache-contract=private";
    await request.get(path);
    const response = await request.get(path, { headers });
    expect(response.status()).toBe(200);
    expect(response.headers()["x-effront-cache"]).toBe("BYPASS");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
  });
}

test("POST cannot read a warmed document cache", async ({ request }) => {
  const path = "/en/guide/markdown?cache-contract=post";
  await request.get(path);
  const response = await request.post(path, { data: "not-a-server-function" });
  expect(response.headers()["x-effront-cache"]).not.toBe("HIT");
  expect(response.status()).not.toBe(200);
});

test("a tab from another deployment performs a document navigation before Flight decoding", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  const target = "/en/guide/markdown";
  // Only alter the outgoing deployment token. The real Worker must reject it,
  // and the real FlightClient/router must turn that response into a reload.
  await page.route(`**${target}`, async (route) => {
    const request = route.request();
    if (request.headers()["accept"] === "text/x-component") {
      await route.continue({
        headers: { ...request.headers(), "x-effront-build-id": "previous-deployment" },
      });
    } else {
      await route.continue();
    }
  });
  const rejected = page.waitForResponse(
    (response) => response.url().endsWith(target) && response.status() === 409,
  );
  const document = page.waitForResponse(
    (response) => response.url().endsWith(target) && response.request().isNavigationRequest(),
  );
  await page.locator(`[data-slot="sidebar-content"] a[href="${target}"]`).click();
  expect((await rejected).headers()["cache-control"]).toBe("private, no-store");
  expect((await document).status()).toBe(200);
  await expect(page).toHaveURL(target);
  await expect(page.locator("article")).toHaveAttribute("data-doc-page", target);
  expect(errors).toEqual([]);
});

test("the build ships the same asset header rules used by the local host", () => {
  expect(readFileSync(new URL("../dist/client/_headers", import.meta.url), "utf8")).toBe(
    readFileSync(new URL("../public/_headers", import.meta.url), "utf8"),
  );
});

test("hashed production assets carry immutable long-lived cache headers", async ({
  page,
  request,
}) => {
  await page.goto("/en");
  const assetPaths = await page
    .locator('script[src], link[rel="stylesheet"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute("src") ?? node.getAttribute("href"))
        .filter((path): path is string => path !== null && path.includes("/assets/")),
    );
  expect(assetPaths.length).toBeGreaterThan(0);
  for (const path of assetPaths) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("immutable");
    expect(response.headers()["cache-control"]).toContain("max-age=31536000");
  }
});
