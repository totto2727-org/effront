import { createServer } from "node:http";

import { expect, it } from "@effect/vitest";
import { HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

import { getResponseUrl } from "./response-url";

it("preserves the final native Fetch URL after a real local redirect", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/before") {
      response.writeHead(302, { location: "/after?redirected=yes" });
      response.end();
      return;
    }
    response.end("redirected");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new TypeError("Expected a local HTTP server address.");
    }
    const origin = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${origin}/before`);
    const wrapped = HttpClientResponse.fromWeb(HttpClientRequest.get(`${origin}/before`), response);
    expect(response.redirected).toBe(true);
    expect(getResponseUrl(wrapped)).toBe(`${origin}/after?redirected=yes`);
    await response.text();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

it("uses the complete original URL without a fragment for synthetic responses", () => {
  const response = HttpClientResponse.fromWeb(
    HttpClientRequest.get("https://example.test/path?value=one#fragment"),
    new Response(),
  );
  expect(getResponseUrl(response)).toBe("https://example.test/path?value=one");
});

it("does not invent a resolved URL for an invalid original request", () => {
  expect(getResponseUrl(HttpClientResponse.fromWeb(HttpClientRequest.empty, new Response()))).toBe(
    "",
  );
});

it("honors an explicit final URL supplied by a custom HTTP transport", () => {
  const response = HttpClientResponse.fromWeb(
    HttpClientRequest.get("https://example.test/before"),
    new Response(),
  );
  Object.defineProperty(response, "url", { value: "https://example.test/after#fragment" });
  expect(getResponseUrl(response)).toBe("https://example.test/after");
});
