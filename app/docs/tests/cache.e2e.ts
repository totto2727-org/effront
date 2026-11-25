import type { APIResponse } from "@playwright/test";
import { expect, test } from "@playwright/test";

const httpStatusOk = 200;
const httpStatusNotFound = 404;

// These local Workerd tests exercise the origin cache policy.
const expectPolicy = (headers: Record<string, string>, publicResponse: boolean): void => {
  expect(headers["cache-control"]).toBe(
    publicResponse ? "public, max-age=0, must-revalidate" : "private, no-store",
  );
  expect(headers["cloudflare-cdn-cache-control"]).toBe(
    publicResponse ? "public, max-age=31536000" : "private, no-store",
  );
  expect(headers["vary"]?.toLowerCase().split(/\s*,\s*/u)).toEqual(
    expect.arrayContaining(["accept"]),
  );
};

const expectPublicRepresentation = async (
  response: APIResponse,
  locale: string,
  accept: string,
): Promise<void> => {
  expect(response.status()).toBe(httpStatusOk);
  const contentType = accept === "*/*" || accept === "text/*" ? "text/html" : accept;
  expect(response.headers()["content-type"]).toContain(contentType);
  expectPolicy(response.headers(), true);
  const body = await response.text();
  expect(body).toContain(`/${locale}/guide/markdown`);
  if (contentType === "text/html") {
    expect(body).toContain(`lang="${locale}"`);
  } else {
    expect(body).not.toContain("<!DOCTYPE html>");
  }
};

["en", "ja"].forEach((locale) => {
  ["text/html", "text/x-component", "*/*", "text/*"].forEach((accept) => {
    ["one", "two"].forEach((query) => {
      test(`origin serves ${locale} ${accept} with public policy for query ${query}`, async ({
        request,
      }) => {
        const response = await request.get(`/${locale}/guide/markdown?cache-contract=${query}`, {
          headers: { Accept: accept },
        });
        await expectPublicRepresentation(response, locale, accept);
      });
    });
  });
});

test("origin accepts a browser document Accept header", async ({ request }) => {
  const response = await request.get("/en/guide/markdown", {
    headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  expect(response.status()).toBe(httpStatusOk);
  expectPolicy(response.headers(), true);
  expect(await response.text()).toContain('lang="en"');
});

["text/html;q=2", "text/html;q=0, text/html", "text/*;q=0.5, */*"].forEach((accept) => {
  test(`origin uses negotiator semantics for Accept ${accept}`, async ({ request }) => {
    const response = await request.get("/en/guide/markdown", { headers: { Accept: accept } });
    expect(response.status()).toBe(httpStatusOk);
    expect(response.headers()["content-type"]).toContain("text/html");
    expectPolicy(response.headers(), true);
    expect(await response.text()).toContain('lang="en"');
  });
});

["application/json", "*/*;q=0", "text/html;q=0, */*", "text/*;q=0, */*"].forEach((accept) => {
  test(`origin leaves excluded Accept ${accept} private`, async ({ request }) => {
    const response = await request.get("/en/guide/markdown", { headers: { Accept: accept } });
    expect(response.status()).toBe(httpStatusOk);
    expectPolicy(response.headers(), false);
  });
});

test("origin does not opt missing pages into long-lived CDN caching", async ({ request }) => {
  const response = await request.get("/en/missing-cache-test-page", {
    headers: { Accept: "text/html" },
  });
  expect(response.status()).toBe(httpStatusNotFound);
  // Missing-route responses have no cache opt-in headers on the real host.
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBeUndefined();
  expect(response.headers()["cache-control"] ?? "").not.toContain("public");
});

["Cookie", "Authorization"].forEach((name) => {
  test(`origin keeps ${name} requests public without varying on credentials`, async ({
    request,
  }) => {
    const headers = {
      Accept: "text/html",
      [name]: name === "Cookie" ? "session=private" : "Bearer private",
    };
    const response = await request.get("/en/guide/markdown", { headers });
    expect(response.status()).toBe(httpStatusOk);
    expectPolicy(response.headers(), true);
    const responseHeaders = response.headers();
    const vary = responseHeaders["vary"]?.toLowerCase().split(/\s*,\s*/u);
    expect(vary).not.toContain("cookie");
    expect(vary).not.toContain("authorization");
  });
});

test("origin marks invalid POST private", async ({ request }) => {
  const response = await request.post("/en/guide/markdown", {
    data: "not-a-server-function",
    headers: { Accept: "text/html" },
  });
  expect(response.status()).not.toBe(httpStatusOk);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBeUndefined();
});
