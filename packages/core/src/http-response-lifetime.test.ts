import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, Stream } from "effect";
import { HttpServerResponse } from "effect/http";

import {
  captureHandler,
  encoder,
  makeProbeApplication,
  releaseCounts,
} from "./http-probe.fixture.ts";
import type { Acquisition } from "./http-probe.fixture.ts";
import { request } from "./http-request.fixture.ts";

class BodyFailure extends Data.TaggedError("BodyFailure")<Readonly<{ message: string }>> {}

describe("streamed HTTP body completion", () => {
  it.effect("retains the request layer until the delayed body reaches eof", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const read: number[] = [];
      const app = makeProbeApplication(acquisitions, ({ label }) => {
        const chunk = Effect.sync(() => {
          read.push(...releaseCounts(acquisitions));
          return encoder.encode(label);
        });
        return Effect.succeed(HttpServerResponse.stream(Stream.fromEffect(chunk)));
      });
      const handle = yield* captureHandler(app);
      const response = yield* Effect.promise(async () => handle(request("eof")));
      const text = yield* Effect.promise(async () => response.text());

      expect({ read, released: releaseCounts(acquisitions), text }).toStrictEqual({
        read: [0],
        released: [1],
        text: "captured:eof",
      });
    }),
  );

  it.effect("closes the request layer when the response body fails", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const failure = new BodyFailure({ message: "body failed" });
      const body = Stream.fail(failure);
      const app = makeProbeApplication(acquisitions, () =>
        Effect.succeed(HttpServerResponse.stream(body)),
      );
      const handle = yield* captureHandler(app);
      const response = yield* Effect.promise(async () => handle(request("error")));
      yield* Effect.promise(async () => expect(response.text()).rejects.toThrow("body failed"));
      expect(releaseCounts(acquisitions)).toStrictEqual([1]);
    }),
  );
});

const waitForReleases = (acquisitions: Acquisition[], expected: number[]): Effect.Effect<void> =>
  Effect.promise(async () => {
    await expect.poll(() => releaseCounts(acquisitions)).toStrictEqual(expected);
  });

describe("responses without streaming bodies", () => {
  it.effect("closes request resources for head and non-stream responses", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const probe = yield* captureHandler(makeProbeApplication(acquisitions));
      const head = yield* Effect.promise(async () => probe(request("head", { method: "HEAD" })));
      expect(head.body).toBeNull();
      yield* waitForReleases(acquisitions, [1]);

      const app = makeProbeApplication(acquisitions, () =>
        Effect.succeed(HttpServerResponse.empty()),
      );
      const handle = yield* captureHandler(app);
      yield* Effect.promise(async () => handle(request("empty")));
      yield* waitForReleases(acquisitions, [1, 1]);
    }),
  );

  it.effect("preserves streamed get metadata for head and releases the request scope", () =>
    Effect.gen(function* () {
      const acquisitions: Acquisition[] = [];
      const status = 202;
      const contentLength = 123;
      const response = HttpServerResponse.stream(Stream.never, {
        contentLength,
        contentType: "text/custom",
        headers: { "x-result": "head" },
        status,
      });
      const app = makeProbeApplication(acquisitions, () => Effect.succeed(response));
      const handle = yield* captureHandler(app);
      const head = yield* Effect.promise(async () => handle(request("head", { method: "HEAD" })));
      expect({
        contentLength: head.headers.get("content-length"),
        contentType: head.headers.get("content-type"),
        result: head.headers.get("x-result"),
        status: head.status,
      }).toStrictEqual({
        contentLength: "123",
        contentType: "text/custom",
        result: "head",
        status,
      });
      expect(head.body).toBeNull();
      yield* waitForReleases(acquisitions, [1]);
    }),
  );
});
