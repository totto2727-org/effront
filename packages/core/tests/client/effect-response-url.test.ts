// oxlint-disable-next-line rules/no-node-imports -- The dependency contract test emits a real HTTP redirect on loopback.
import { createServer } from "node:http";
// oxlint-disable-next-line rules/no-node-imports -- Wait on native server lifecycle events to close the test listener.
import { once } from "node:events";

import { describe, expect, test } from "@effect/vitest";
import { Data, Predicate } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

type Server = ReturnType<typeof createServer>;

const localHost = "127.0.0.1";
const ephemeralPort = 0;
const redirectStatus = 302;
const before = "/before";
const after = "/after?redirected=yes";

class MissingLocalAddress extends Data.TaggedError("MissingLocalAddress") {}

const redirectServer = (): Server =>
  createServer((request, response) => {
    if (request.url === before) {
      response.writeHead(redirectStatus, { location: after });
      response.end();
    } else {
      response.end("redirected");
    }
  });

const listen = async (server: Server): Promise<string> => {
  const listening = once(server, "listening");
  server.listen({ host: localHost, port: ephemeralPort });
  await listening;
  const address = server.address();
  if (Predicate.isNullish(address) || Predicate.isString(address)) {
    throw new MissingLocalAddress();
  }
  return `http://${localHost}:${address.port}`;
};

const stop = async (server: Server): Promise<void> => {
  const closed = once(server, "close");
  server.closeAllConnections();
  server.close();
  await closed;
};

const followNativeRedirect = async (
  origin: string,
): Promise<Readonly<{ redirected: boolean; url: string }>> => {
  const url = `${origin}${before}`;
  // oxlint-disable-next-line rules/no-fetch -- The contract check requires the real native response and its resolved URL.
  const response = await fetch(url);
  const wrapped = HttpClientResponse.fromWeb(HttpClientRequest.get(url), response);
  await response.text();
  return { redirected: response.redirected, url: wrapped.url };
};

describe("native Fetch response URLs", () => {
  test("resolves the final native Fetch URL after a real local redirect", async () => {
    expect.hasAssertions();
    const server = redirectServer();
    try {
      const origin = await listen(server);
      await expect(followNativeRedirect(origin)).resolves.toStrictEqual({
        redirected: true,
        url: `${origin}${after}`,
      });
    } finally {
      await stop(server);
    }
  });

  test("uses the complete original URL without a fragment for synthetic responses", () => {
    const response = HttpClientResponse.fromWeb(
      HttpClientRequest.get("https://example.test/path?value=one#fragment"),
      new Response(),
    );
    expect(response.url).toBe("https://example.test/path?value=one");
  });

  test("does not invent a resolved URL for an invalid original request", () => {
    expect(HttpClientResponse.fromWeb(HttpClientRequest.empty, new Response()).url).toBe("");
  });
});
