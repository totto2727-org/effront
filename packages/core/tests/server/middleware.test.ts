import { assert, expect, it } from "@effect/vitest";
import { Deferred, Effect, Predicate, Stream } from "effect";
import { HttpEffect, HttpRouter, HttpServerResponse } from "effect/http";

import { Application } from "#core/application/effront.ts";
import { getScopedMiddlewareHandler } from "#core/application/middleware.ts";

const bodyText = "response";
const firstChunk = Stream.make(bodyText).pipe(Stream.encodeText);
const requestUrl = "http://localhost/";

const middlewareResponse = Effect.fn("middlewareResponse")(function* (
  events: string[],
  stream: Stream.Stream<Uint8Array>,
) {
  const EFFRONT = Application.effront();
  const Middleware = EFFRONT.Middleware.make((httpEffect) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        events.push("acquired");
      }),
      () =>
        Effect.sync(() => {
          events.push("released");
        }),
    ).pipe(Effect.andThen(httpEffect)),
  );
  const response = Effect.succeed(HttpServerResponse.stream(stream));
  const wrap = getScopedMiddlewareHandler(Middleware);
  const route = HttpRouter.add("GET", "/", wrap(response));
  const httpEffect = yield* HttpRouter.toHttpEffect(route);
  const handler = HttpEffect.toWebHandler(httpEffect);
  return yield* Effect.promise(async () => handler(new Request(requestUrl)));
});

it.effect("retains middleware resources through streaming response EOF", () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const finish = yield* Deferred.make<boolean>();
    const delayedEof = Stream.fromEffect(Deferred.await(finish)).pipe(
      Stream.map(() => new Uint8Array()),
    );
    const response = yield* middlewareResponse(events, Stream.concat(firstChunk, delayedEof));
    expect(events).toStrictEqual(["acquired"]);
    const body = response.text();

    yield* Deferred.succeed(finish, true);
    const responseBody = yield* Effect.promise(async () => body);
    expect({ events, responseBody }).toStrictEqual({
      events: ["acquired", "released"],
      responseBody: bodyText,
    });
  }),
);

it.effect("releases middleware resources when the response stream is canceled", () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const response = yield* middlewareResponse(events, Stream.concat(firstChunk, Stream.never));
    const { body } = response;
    assert(Predicate.isNotNullish(body));
    const reader = body.getReader();

    yield* Effect.promise(async () => reader.read());
    expect(events).toStrictEqual(["acquired"]);
    yield* Effect.promise(async () => reader.cancel());
    expect(events).toStrictEqual(["acquired", "released"]);
  }),
);
