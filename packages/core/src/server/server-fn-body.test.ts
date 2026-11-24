import { live } from "@effect/vitest";
import { Deferred, Effect, Fiber, Predicate, Result } from "effect";
import { expect } from "vitest";

import { readServerFnBody } from "./server-fn-body.ts";
import { badRequest } from "./server-fn-request-error.ts";

const maximumBodyBytes = 10_485_760;
const singleByte = 1;
const bodyEndpoint = "http://localhost/action";

const streamRequest = (body: ReadableStream<Uint8Array>): Request => {
  // Node needs a half-duplex declaration when the test supplies a streaming request body.
  const init = { body, duplex: "half", method: "POST" };
  return new Request(bodyEndpoint, init);
};

live("accepts a Server Function body at the byte limit", () =>
  Effect.gen(function* () {
    const request = new Request(bodyEndpoint, {
      body: new Uint8Array(maximumBodyBytes),
      method: "POST",
    });
    const decoded = yield* readServerFnBody(request);
    expect(Predicate.isString(decoded) && decoded.length).toBe(maximumBodyBytes);
    expect(request.body?.locked).toBe(false);
  }),
);

live("rejects a streamed body above the byte limit and releases the reader", () =>
  Effect.gen(function* () {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maximumBodyBytes));
        controller.enqueue(new Uint8Array(singleByte));
        controller.close();
      },
    });
    const request = streamRequest(body);
    const decoded = yield* Effect.result(readServerFnBody(request));
    expect(Result.isFailure(decoded) && decoded.failure.status).toBe(badRequest);
    expect(Result.isFailure(decoded) && decoded.failure.message).toContain("10 MiB");
    expect(body.locked).toBe(false);
  }),
);

live("releases the body reader if the request is interrupted during a read", () =>
  Effect.gen(function* () {
    const reading = yield* Deferred.make<boolean>();
    const noPrefetch = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          Deferred.doneUnsafe(reading, Effect.succeed(true));
        },
      },
      { highWaterMark: noPrefetch },
    );
    const fiber = yield* Effect.forkChild(readServerFnBody(streamRequest(body)));
    yield* Deferred.await(reading);
    expect(body.locked).toBe(true);
    yield* Fiber.interrupt(fiber);
    expect(body.locked).toBe(false);
  }),
);
