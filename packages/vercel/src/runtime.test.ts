import { once } from "node:events";
import { createServer } from "node:http";
import { Effect, Stream } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { expect, test } from "vitest";
import { createHandler } from "./runtime";

test("native response streaming retains request resources until the client cancels", async () => {
  const released = Promise.withResolvers<void>();
  let active = 0;
  const application = Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        active++;
      }),
      () =>
        Effect.sync(() => {
          active--;
          released.resolve();
        }),
    );
    return HttpServerResponse.stream(
      Stream.concat(Stream.make(new TextEncoder().encode("first")), Stream.never),
    );
  });
  const runtime = await createHandler(application);
  const server = createServer(runtime.handler);
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Expected a TCP listener.");
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    const reader = response.body?.getReader();
    if (reader === undefined) throw new Error("Expected a streaming response body.");
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("first");
    expect(active).toBe(1);
    await reader.cancel();
    await released.promise;
    expect(active).toBe(0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await runtime.close();
  }
});

test("native streaming completion releases resources before the next warm invocation", async () => {
  let active = 0;
  const application = Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        active++;
      }),
      () =>
        Effect.sync(() => {
          active--;
        }),
    );
    return HttpServerResponse.stream(Stream.make(new TextEncoder().encode("complete")));
  });
  const runtime = await createHandler(application);
  const server = createServer(runtime.handler);
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Expected a TCP listener.");
    for (let invocation = 0; invocation < 2; invocation++) {
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      expect(await response.text()).toBe("complete");
      expect(active).toBe(0);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await runtime.close();
  }
});
