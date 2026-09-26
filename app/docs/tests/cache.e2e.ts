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
    expect.arrayContaining(["accept"]),
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

test("origin accepts a browser document Accept header", async ({ request }) => {
  const response = await request.get("/en/guide/markdown", {
    headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  expect(response.status()).toBe(200);
  expectPolicy(response.headers(), true);
  expect(await response.text()).toContain('lang="en"');
});

test("origin leaves unsupported Accept private", async ({ request }) => {
  const response = await request.get("/en/guide/markdown", { headers: { Accept: "*/*" } });
  expect(response.status()).toBe(200);
  expectPolicy(response.headers(), false);
});

test("origin does not opt missing pages into long-lived CDN caching", async ({ request }) => {
  const response = await request.get("/en/missing-cache-test-page", {
    headers: { Accept: "text/html" },
  });
  expect(response.status()).toBe(404);
  // Missing-route responses have no cache opt-in headers on the real host.
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBeUndefined();
  expect(response.headers()["cache-control"] ?? "").not.toContain("public");
});

for (const name of ["Cookie", "Authorization"]) {
  test(`origin keeps ${name} requests public without varying on credentials`, async ({
    request,
  }) => {
    const headers = {
      Accept: "text/html",
      [name]: name === "Cookie" ? "session=private" : "Bearer private",
    };
    const response = await request.get("/en/guide/markdown", { headers });
    expect(response.status()).toBe(200);
    expectPolicy(response.headers(), true);
    const vary = response
      .headers()
      ["vary"]?.toLowerCase()
      .split(/\s*,\s*/);
    expect(vary).not.toContain("cookie");
    expect(vary).not.toContain("authorization");
  });
}

test("origin marks invalid POST private", async ({ request }) => {
  const response = await request.post("/en/guide/markdown", {
    headers: { Accept: "text/html" },
    data: "not-a-server-function",
  });
  expect(response.status()).not.toBe(200);
  expectPolicy(response.headers(), false);
});
