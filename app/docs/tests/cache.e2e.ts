import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Local workerd validates origin policy, not the managed Workers Cache in front
// of a deployed Worker. Native HITs and version isolation need deployment checks.
const expectPolicy = (headers: Record<string, string>, publicResponse: boolean) => {
  expect(headers["cache-control"]).toBe(
    publicResponse ? "public, max-age=0, must-revalidate" : "private, no-store",
  );
  expect(headers["cloudflare-cdn-cache-control"]).toBe(
    publicResponse ? "public, max-age=31536000" : "private, no-store",
  );
  expect(headers["vary"]?.toLowerCase().split(/\s*,\s*/)).toEqual(
    expect.arrayContaining(["accept", "cookie", "authorization"]),
  );
};

for (const locale of ["en", "ja"]) {
  for (const accept of ["text/html", "text/x-component"]) {
    for (const query of ["one", "two"]) {
      test(`origin serves ${locale} ${accept} with public policy for query ${query}`, async ({
        request,
      }) => {
        const response = await request.get(`/${locale}/guide/markdown?cache-contract=${query}`, {
          headers: { Accept: accept },
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
