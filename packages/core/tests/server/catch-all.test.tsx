import { describe, expect, test } from "@effect/vitest";
import { Cause, Exit, Schema } from "effect";

import type { FetchHandler } from "#core/workers.ts";
import { makeHandler, makeNativeHandler, makeValidationHandler } from "./catch-all.fixture.ts";

const origin = "https://routes.test";
const ok = 200;
const notFound = 404;
const types = ["text/html", "text/x-component"];
const methods = ["GET", "HEAD", "POST"];
const requests = methods.flatMap((method) => types.map((accept) => ({ accept, method })));
const NativeMatch = Schema.Struct({
  params: Schema.Record(Schema.String, Schema.String),
  pattern: Schema.String,
});
const decodeNativeMatch = Schema.decodeExit(Schema.fromJsonString(NativeMatch));

const sequentially = async <A,>(
  values: Readonly<A[]>,
  check: (value: A) => Promise<void>,
): Promise<void> => {
  // oxlint-disable-next-line rules/no-for-loops -- Run each native and Effront response comparison before starting another HTTP case.
  for (const value of values) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Consume and close the current response before the next request.
    await check(value);
  }
};

const expectedMatch = async (response: Response): Promise<typeof NativeMatch.Type> => {
  const text = await response.text();
  const decoded = decodeNativeMatch(text);
  if (Exit.isFailure(decoded)) {
    throw Cause.squash(decoded.cause);
  }
  const { params, pattern } = decoded.value;
  const { "*": captured, ...named } = params;
  return { params: pattern.endsWith("/*") ? { ...named, path: captured ?? "" } : params, pattern };
};

type Handlers = Readonly<{
  effront: FetchHandler;
  native: ReturnType<typeof makeNativeHandler>["handler"];
}>;

const compare = async (
  { effront, native }: Handlers,
  pathname: string,
  { accept, method }: (typeof requests)[number],
): Promise<void> => {
  const request = new Request(`${origin}${pathname}`, { headers: { accept }, method });
  const reference = await native(request.clone());
  const response = await effront(request, {}, {});
  expect(response.status).toBe(reference.status);
  if (method === "GET" && reference.status === ok) {
    const match = await expectedMatch(reference);
    await expect(response.json()).resolves.toStrictEqual(match);
  } else {
    const body = await reference.text();
    await expect(response.text()).resolves.toBe(body);
  }
};

const routeCases = [
  "/manual",
  "/manual/",
  "/manual/a/b/c/d",
  "/manual/guide/%E6%97%A5%E6%9C%AC%E8%AA%9E%20space",
  "/manual/guide/%252F%252e%252e%25",
  "/manual/guide/punctuation!()'$&+,=@",
  "/manual/guide/a%3Fb%23c",
  "/manual/about",
  "/manual/hello%20there",
  "/localized/ja",
  "/localized/ja/a/b",
  "/localized/ja%2Fen/a%5Cb",
  "/plain",
  "/%E6%97%A5%E6%9C%AC%E8%AA%9E/%E5%85%A5%E9%96%80",
  "/manual/guide/%",
  "/manual/guide/%E0%A4%A",
  "/manual/guide/%FF",
  "/manual/guide/a%2fb",
  "/manual/guide/a%5Cb",
  "/manual/guide/%00",
  "/manual/guide/%1F",
  "/manual/guide/%7f",
  "/manual/guide//nested",
  "/manual/guide/./nested",
  "/manual/guide/%2e%2e/nested",
  "/manual/guide/leaf/",
  "/MANUAL/guide/leaf?query=value",
  "/manuals/a/b",
];

describe("catch-all matching and decoding", () => {
  test.each(routeCases)(
    "delegates %s matching and decoding to native Effect HTTP",
    async (pathname) => {
      expect.hasAssertions();
      const effront = makeHandler();
      const native = makeNativeHandler();
      try {
        await sequentially(requests, async (request) =>
          compare({ effront, native: native.handler }, pathname, request),
        );
      } finally {
        await native.dispose();
      }
    },
  );
});

const expectUnknown = async (handler: FetchHandler, pathname: string): Promise<void> => {
  const response = await handler(new Request(`${origin}${pathname}`), {}, {});
  expect(response.status).toBe(notFound);
  await response.body?.cancel();
};

const expectRejectedParams = async (handler: FetchHandler, accept: string): Promise<void> => {
  const request = new Request(`${origin}/manual/not/allowed`, { headers: { accept } });
  const response = await handler(request, {}, {});
  expect(response.status).toBe(notFound);
  expect(response.headers.get("vary")).toBe("Accept");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  await response.body?.cancel();
};

describe("catch-all HTTP responses", () => {
  test("preserves HEAD fallback and returns 404 outside registered prefixes", async () => {
    expect.hasAssertions();
    const handler = makeHandler();
    const request = new Request(`${origin}/manual/a/b`, { method: "HEAD" });
    const head = await handler(request, {}, {});
    expect(head.status).toBe(ok);
    await expect(head.text()).resolves.toBe("");
    await sequentially(
      ["/manuals/a/b", "/_effront/assets/a", "/plain/unregistered"],
      async (pathname) => expectUnknown(handler, pathname),
    );
  });

  test("decodes the named catch-all Page schema before selecting HTML or Flight rendering", async () => {
    expect.hasAssertions();
    const handler = makeValidationHandler();
    await sequentially(types, async (accept) => expectRejectedParams(handler, accept));
  });
});
