import { assert, describe, expect, test } from "vite-plus/test";

import type { FetchHandler } from "#core/workers.ts";
import { makeApplication } from "./userland-http.fixture.ts";

const origin = "https://workers.test";
const ok = 200;
const accepted = 202;
const missing = 404;
// oxlint-disable-next-line unicorn/no-null -- Fetch Headers uses null for absent values.
const absentHeader = null;
const greeting = "こんにちは、Ada さん。";

type Access = Readonly<{ requestId: string; value: string }>;

const call = async (
  handler: FetchHandler,
  pathname: string,
  { requestId, value }: Access,
): Promise<Response> => handler(new Request(`${origin}${pathname}`), { value }, { requestId });

const checkIsolatedResponse = async (response: Response, requestId: string): Promise<void> => {
  assert.strictEqual(response.status, accepted);
  assert.include(response.headers.get("content-type"), "application/json");
  const body: unknown = await response.json();
  assert.deepEqual(body, {
    method: "GET",
    requestId,
    url: `${origin}/api/status?request=${requestId}`,
    value: `env:${requestId}`,
  });
};

const requestStatus = async (handler: FetchHandler, requestId: string): Promise<Response> =>
  call(handler, `/api/status?request=${requestId}`, { requestId, value: `env:${requestId}` });

const securityHeaders = (response: Response): Record<string, string | null> => ({
  application: response.headers.get("x-application-scoped"),
  global: response.headers.get("x-content-type-options"),
});

describe("unmatched and guide HTTP routes", () => {
  test("does not map global response headers onto an unmatched route failure", async () => {
    expect.hasAssertions();
    const { events, handler } = makeApplication();
    const response = await call(handler, "/unknown", { requestId: "unknown", value: "unknown" });
    expect(response.status).toBe(missing);
    expect(securityHeaders(response)).toStrictEqual({
      application: absentHeader,
      global: absentHeader,
    });
    await response.text();
    expect(events).toStrictEqual(["acquired:unknown", "released:unknown"]);
  });

  test("executes the Guide's service-backed JSON route and releases completed non-stream responses", async () => {
    expect.hasAssertions();
    const { events, handler } = makeApplication();
    const response = await call(handler, "/api/greeting", { requestId: "one", value: "first" });
    expect(response.status).toBe(ok);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(securityHeaders(response)).toStrictEqual({
      application: absentHeader,
      global: "nosniff",
    });
    await expect(response.json()).resolves.toStrictEqual({ message: greeting });
    await expect.poll(() => events).toEqual(["acquired:one", "released:one"]);
  });
});

describe("request-local services and middleware", () => {
  test("keeps application-layer environment services request-local and preserves JSON status", async () => {
    expect.hasAssertions();
    const { events, handler } = makeApplication();
    const [first, second] = await Promise.all([
      requestStatus(handler, "one"),
      requestStatus(handler, "two"),
    ]);
    await checkIsolatedResponse(first, "one");
    await checkIsolatedResponse(second, "two");
    expect(events.filter((event) => event.startsWith("released:")).toSorted()).toStrictEqual([
      "released:one",
      "released:two",
    ]);
  });

  test("applies global HTTP middleware to both route kinds but application middleware only to its scope", async () => {
    expect.hasAssertions();
    const { events, handler } = makeApplication();
    const api = await call(handler, "/api/greeting", { requestId: "api", value: "api" });
    expect(securityHeaders(api)).toStrictEqual({ application: absentHeader, global: "nosniff" });
    await api.json();

    const page = await call(handler, "/page", { requestId: "page", value: "page" });
    expect(page.status).toBe(ok);
    expect(securityHeaders(page)).toStrictEqual({ application: "yes", global: "nosniff" });
    await expect(page.json()).resolves.toStrictEqual({
      message: greeting,
      requestId: "page",
      scopedUrl: "/page",
      url: `${origin}/page`,
      value: "page",
    });
    expect(events).toStrictEqual([
      "acquired:api",
      "released:api",
      "acquired:page",
      "released:page",
    ]);
  });
});
