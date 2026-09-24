import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { buildHeaders } from "./cache-headers";

// Local workerd validates the origin policy, not native Workers Cache HIT behavior.
// Native caching runs before the Worker and requires a real deployment to verify
// HITs, exact Vary partitioning, and version isolation. Cloudflare strips its CDN
// header on egress, while this local origin exposes it for policy assertions.
const expectPolicy = (headers: Record<string, string>, publicResponse: boolean) => {
  expect(headers["cache-control"]).toBe(
    publicResponse ? "public, max-age=0, must-revalidate" : "private, no-store",
  );
  expect(headers["cloudflare-cdn-cache-control"]).toBe(
    publicResponse ? "public, max-age=31536000" : "private, no-store",
  );
  expect(headers["x-effront-build-id"]).toBeTruthy();
  expect(headers["vary"]?.toLowerCase().split(/\s*,\s*/)).toEqual(
    expect.arrayContaining(["accept", "cookie", "authorization", "x-effront-build-id"]),
  );
};

for (const locale of ["en", "ja"]) {
  for (const accept of ["text/html", "text/x-component"]) {
    for (const query of ["one", "two"]) {
      test(`origin serves ${locale} ${accept} with public policy for query ${query}`, async ({
        request,
      }) => {
        const headers = { ...(await buildHeaders(request)), Accept: accept };
        const response = await request.get(`/${locale}/guide/markdown?cache-contract=${query}`, {
          headers,
        });
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain(accept);
        expectPolicy(response.headers(), true);
        const body = await response.text();
        expect(body).toContain(`/${locale}/guide/markdown`);
        if (accept === "text/html") expect(body).toContain(`lang="${locale}"`);
        else expect(body).not.toContain("<!DOCTYPE html>");
      });
    }
  }
}

for (const buildId of [undefined, "previous-deployment"]) {
  test(`origin rejects Flight with ${buildId ?? "missing"} build token`, async ({ request }) => {
    const response = await request.get("/en/guide/markdown", {
      headers: {
        Accept: "text/x-component",
        ...(buildId ? { "x-effront-build-id": buildId } : {}),
      },
    });
    expect(response.status()).toBe(409);
    expectPolicy(response.headers(), false);
    expect(response.headers()["content-type"]).toBeUndefined();
    expect(await response.body()).toHaveLength(0);
  });
}

for (const name of ["Cookie", "Authorization"]) {
  test(`origin marks ${name} requests private`, async ({ request }) => {
    const headers = { [name]: name === "Cookie" ? "session=private" : "Bearer private" };
    const response = await request.get("/en/guide/markdown", { headers });
    expect(response.status()).toBe(200);
    expectPolicy(response.headers(), false);
  });
}

test("origin marks invalid POST private", async ({ request }) => {
  const response = await request.post("/en/guide/markdown", { data: "not-a-server-function" });
  expect(response.status()).not.toBe(200);
  expectPolicy(response.headers(), false);
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
