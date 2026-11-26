// oxlint-disable-next-line rules/no-node-imports -- The middleware-mode test owns a separate native HTTP listener and hands Vite its request handler.
import { createServer as createHttpServer } from "node:http";
// oxlint-disable-next-line rules/no-node-imports -- These are the native listener types exercised by the middleware fixture.
import type { Server } from "node:http";

import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { effront } from "@effront/vite";
import { Data, Effect, Path, Predicate, Schedule } from "effect";
import { createServer, isRunnableDevEnvironment } from "vite";
import type { Plugin, RunnableDevEnvironment, ViteDevServer } from "vite";
import { afterEach, describe, expect, vi } from "vitest";

import { effrontServer } from "./vite.ts";

const entry = "virtual:effront-native-http-test";
const resolvedEntry = `\0${entry}`;
const eventsKey = "__effront_native_http_test_events__";

const handlerSource = (version: string): string => `
  import { Effect, Stream } from 'effect';
  import { HttpServerRequest, HttpServerResponse } from 'effect/http';
  export const handler = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.url === '/custom' || request.url === '/failure') {
      const response = yield* HttpServerResponse.text('日本語の応答', {
        status: request.url === '/failure' ? 400 : 299,
        statusText: request.url === '/failure' ? undefined : 'Application Status',
        contentType: 'text/plain;charset=utf-8',
        headers: { 'x-application': 'retained' },
      }).pipe(HttpServerResponse.setCookie('session', 'retained'));
      return request.url === '/failure' ? yield* Effect.fail(response) : response;
    }
    if (request.url === '/stream') {
      yield* Effect.acquireRelease(
        Effect.sync(() => globalThis[${JSON.stringify(eventsKey)}].push('acquired')),
        () => Effect.sync(() => globalThis[${JSON.stringify(eventsKey)}].push('released')),
      );
      return HttpServerResponse.stream(
        Stream.concat(Stream.make(new TextEncoder().encode('streaming')), Stream.never),
      );
    }
    return HttpServerResponse.text(
      ${JSON.stringify(version)} + ':' + request.method + ':' + request.url + ':' + request.source.constructor.name,
    );
  });
  if (import.meta.hot) import.meta.hot.accept();
`;

class NativeFixtureFailure extends Data.TaggedError("NativeFixtureFailure")<{
  message: string;
}> {}

const fixtureRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  const location = new URL("../../../tests/e2e-server/fixtures/node/", import.meta.url);
  return yield* path.fromFileUrl(location);
}).pipe(Effect.provide(NodeServices.layer));

const setupServer = Effect.fnUntraced(function* (middlewareMode: boolean) {
  const root = yield* fixtureRoot;
  const entryScript = { source: handlerSource("first") };
  const fixture: Plugin = {
    load: (id) => (id === resolvedEntry ? entryScript.source : undefined),
    name: "effront-native-http-fixture",
    resolveId: (id) => (id === entry ? resolvedEntry : undefined),
  };
  const open = Effect.promise(async () =>
    createServer({
      configFile: false,
      logLevel: "silent",
      plugins: [effront(), fixture, effrontServer({ rsc: entry })],
      root,
      server: { host: "127.0.0.1", middlewareMode, port: 0 },
    }),
  );
  const server = yield* Effect.acquireRelease(open, (owned) =>
    Effect.promise(async () => owned.close()),
  );
  return {
    change: (version: string) => {
      entryScript.source = handlerSource(version);
    },
    server,
  };
});

const originOf = (server: Server | ViteDevServer["httpServer"]): string => {
  const address = server?.address();
  if (Predicate.isNullish(address) || Predicate.isString(address)) {
    throw new NativeFixtureFailure({ message: "Missing HTTP server address" });
  }
  return `http://127.0.0.1:${address.port}`;
};

const listen = Effect.fnUntraced(function* (server: ViteDevServer) {
  yield* Effect.promise(async () => server.listen());
  return originOf(server.httpServer);
});

const readResponse = (url: string): Effect.Effect<Response> =>
  // oxlint-disable-next-line rules/no-fetch -- The fixture asserts native HTTP reason phrases and cancels the exact native response stream.
  Effect.promise(async () => fetch(url));

const text = (response: Response): Effect.Effect<string> =>
  Effect.promise(async () => response.text());

interface LoadedRsc {
  environment: RunnableDevEnvironment;
  module: NonNullable<ReturnType<RunnableDevEnvironment["moduleGraph"]["getModuleById"]>>;
}

const runningRsc = (server: ViteDevServer): LoadedRsc => {
  const environment = server.environments["rsc"];
  if (Predicate.isNullish(environment) || !isRunnableDevEnvironment(environment)) {
    throw new NativeFixtureFailure({ message: "Missing runnable RSC environment" });
  }
  const module = environment.moduleGraph.getModuleById(resolvedEntry);
  if (Predicate.isNullish(module)) {
    throw new NativeFixtureFailure({ message: "RSC module was not loaded" });
  }
  return { environment, module };
};

const readStream = (response: Response): ReadableStreamDefaultReader<Uint8Array> => {
  const reader = response.body?.getReader();
  if (Predicate.isNullish(reader)) {
    throw new NativeFixtureFailure({ message: "Missing streaming response body" });
  }
  return reader;
};

const openHost = (server: ViteDevServer): Effect.Effect<Server, NativeFixtureFailure> =>
  Effect.callback((resume) => {
    const host = createHttpServer(server.middlewares);
    const onError = (): void => {
      resume(
        Effect.fail(new NativeFixtureFailure({ message: "Could not bind the test listener" })),
      );
    };
    host.once("error", onError);
    host.listen(0, "127.0.0.1", () => {
      host.off("error", onError);
      resume(Effect.succeed(host));
    });
  });

const closeHost = (host: Server): Effect.Effect<void, NativeFixtureFailure> =>
  Effect.callback((resume) => {
    host.closeAllConnections();
    host.close((cause) => {
      if (Predicate.isNullish(cause)) {
        resume(Effect.void);
      } else {
        resume(
          Effect.fail(new NativeFixtureFailure({ message: "Could not close the test listener" })),
        );
      }
    });
  });

const setupListener = Effect.gen(function* () {
  const { change, server } = yield* setupServer(false);
  const origin = yield* listen(server);
  return { change, origin, server };
});

const standaloneOrigin = Effect.fnUntraced(function* (server: ViteDevServer) {
  const host = yield* Effect.acquireRelease(openHost(server), (owned) =>
    closeHost(owned).pipe(Effect.orDie),
  );
  return originOf(host);
});

const openStream = Effect.fnUntraced(function* (origin: string) {
  const response = yield* readResponse(`${origin}/stream`);
  const reader = readStream(response);
  const first = yield* Effect.promise(async () => reader.read());
  return { first, reader };
});

const pollingInterval = Schedule.spaced("25 millis");
const pollingLimit = 40;
const awaitReloadedBody = (origin: string, expected: string): Effect.Effect<string> =>
  readResponse(`${origin}/route`).pipe(
    Effect.flatMap(text),
    Effect.repeat({
      schedule: pollingInterval,
      times: pollingLimit,
      until: (content) => content === expected,
    }),
  );

describe("native Vite listener and HMR", () => {
  live("uses one native Vite listener and refreshes the current runner module", () =>
    Effect.gen(function* () {
      const { change, origin, server } = yield* setupListener;
      expect(server.httpServer?.listenerCount("request")).toBe(1);
      const first = yield* readResponse(`${origin}/route?query=value`);
      expect(yield* text(first)).toBe("first:GET:/route?query=value:IncomingMessage");
      const { environment, module } = runningRsc(server);
      change("second");
      yield* Effect.promise(async () => environment.reloadModule(module));
      const expected = "second:GET:/route:IncomingMessage";
      const refreshed = yield* awaitReloadedBody(origin, expected);
      expect(refreshed).toBe(expected);
    }),
  );

  live("leaves Vite client assets ahead of the native request handler", () =>
    Effect.gen(function* () {
      const { origin } = yield* setupListener;
      const viteClient = yield* readResponse(`${origin}/@vite/client`);
      expect(viteClient.status).toBe(200);
      expect(viteClient.headers.get("content-type")).toContain("javascript");
    }),
  );

  live.each([
    ["/custom", 299, "Application Status"],
    ["/failure", 400, "Bad Request"],
  ] as const)("preserves native status and headers for %s", ([path, status, statusText]) =>
    Effect.gen(function* () {
      const { origin } = yield* setupListener;
      const response = yield* readResponse(`${origin}${path}`);
      expect([response.status, response.statusText]).toStrictEqual([status, statusText]);
      expect(response.headers.get("content-type")).toContain("charset=utf-8");
      expect(response.headers.get("x-application")).toBe("retained");
      expect(response.headers.get("set-cookie")).toContain("session=retained");
      expect(yield* text(response)).toBe("日本語の応答");
    }),
  );
});

describe("native Vite streaming request scope", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  live("releases the streaming request scope when the native client cancels", () =>
    Effect.gen(function* () {
      const events: string[] = [];
      vi.stubGlobal(eventsKey, events);
      const { origin } = yield* setupListener;
      const { first, reader } = yield* openStream(origin);
      expect(new TextDecoder().decode(first.value)).toBe("streaming");
      expect(events).toStrictEqual(["acquired"]);
      yield* Effect.promise(async () => reader.cancel());
      const closed = yield* Effect.sync(() => [...events]).pipe(
        Effect.repeat({
          schedule: pollingInterval,
          times: pollingLimit,
          until: (recorded) => recorded.includes("released"),
        }),
      );
      expect(closed).toStrictEqual(["acquired", "released"]);
    }),
  );

  live("closes active request scopes with the middleware-mode Vite container", () =>
    Effect.gen(function* () {
      const events: string[] = [];
      vi.stubGlobal(eventsKey, events);
      const { server } = yield* setupServer(true);
      expect(server.httpServer).toBeNull();
      const origin = yield* standaloneOrigin(server);
      const { reader } = yield* openStream(origin);
      expect(events).toStrictEqual(["acquired"]);
      yield* Effect.promise(async () => server.close());
      expect(events).toStrictEqual(["acquired", "released"]);
      yield* Effect.promise(async () => reader.cancel());
    }),
  );
});
