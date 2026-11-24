import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { FlightMediaType, ServerFnIdHeader } from "#core/rsc/flight.ts";

import {
  actionId,
  clientFor,
  decodeFlight,
  decodedPayload,
  destination,
  encodedArguments,
  flightResponse,
  FlightLoadError,
  home,
  load,
  observeTransport,
  requireFlight,
  resetDecode,
  results,
  transport,
} from "./flight-client.fixture.ts";
import type { RouteRequest } from "./flight-client.fixture.ts";
import { flightRequests, flightResources } from "./flight-client-model.ts";

const mutation = (temporaryReferences: Readonly<Record<string, never>> = {}): RouteRequest =>
  flightRequests.ServerFunction({
    body: encodedArguments,
    destination: home,
    id: actionId,
    temporaryReferences,
  });

it.effect("requests and decodes a whole-tree Flight response", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const { http, observed } = yield* observeTransport(() =>
      flightResponse("text/x-component;charset=utf-8"),
    );
    const response = yield* load(http).pipe(Effect.flatMap(requireFlight));
    const { request } = yield* observed;
    expect([response.payload, response.resolvedUrl.href]).toStrictEqual([
      decodedPayload,
      destination.href,
    ]);
    expect(request).toMatchObject({
      headers: { accept: FlightMediaType },
      method: "GET",
      url: destination.href,
    });
    const options = decodeFlight.mock.lastCall?.[1];
    expect(options?.startTime).toBeTypeOf("number");
    expect(decodeFlight.mock.lastCall?.[0]).toBeInstanceOf(ReadableStream);
    yield* response.release;
  }),
);

it.effect("returns document navigation for a non-Flight navigation response", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const html = new Response("<!doctype html>", {
      headers: { "content-type": "text/html;charset=utf-8" },
    });
    const resource = yield* load(transport(() => html));
    expect(flightResources.$is("Document")(resource)).toBe(true);
    expect(decodeFlight).not.toHaveBeenCalled();
    yield* resource.release;
  }),
);

it.effect("rejects a Flight response without its resolved location", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const response = HttpClientResponse.fromWeb(HttpClientRequest.empty, flightResponse());
    const client = HttpClient.make(() => Effect.succeed(response));
    const error = yield* load(client).pipe(Effect.flip);
    expect(error).toBeInstanceOf(FlightLoadError);
    expect(error.reason).toBe("UnexpectedResponse");
    expect(decodeFlight).not.toHaveBeenCalled();
  }),
);

it.effect("rejects a Server Function result in a route payload", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    decodeFlight.mockResolvedValueOnce(results.Success({ value: "unexpected" }));
    const request = flightRequests.Navigation({ destination: home });
    const http = transport(() => flightResponse());
    const error = yield* load(http, request).pipe(Effect.flip);
    expect(error.reason).toBe("DecodeFailed");
  }),
);

it.effect("rejects a route payload in a query result", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const http = transport(() => flightResponse());
    const client = yield* clientFor(http);
    const query = flightRequests.Query({
      body: encodedArguments,
      destination: new URL("https://effront.test/_effront/query"),
      id: "query-id",
      temporaryReferences: {},
    });
    const error = yield* client.loadQuery(query).pipe(Effect.flip);
    expect(error.reason).toBe("DecodeFailed");
  }),
);

it.effect("rejects a non-Flight Server Function response", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const unauthorized = 401;
    const http = transport(() => new Response("Unauthorized", { status: unauthorized }));
    const error = yield* load(http, mutation()).pipe(Effect.flip);
    expect(error).toBeInstanceOf(FlightLoadError);
    expect(error.reason).toBe("RequestFailed");
  }),
);

it.effect("decodes a Server Function response with its temporary references", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const temporaryReferences = {};
    const { http, observed } = yield* observeTransport(() => flightResponse());
    const response = yield* load(http, mutation(temporaryReferences));
    expect((yield* observed).request).toMatchObject({
      headers: { accept: FlightMediaType, [ServerFnIdHeader]: actionId },
      method: "POST",
      url: home.href,
    });
    const call = decodeFlight.mock.lastCall;
    expect(call?.[0]).toBeInstanceOf(ReadableStream);
    expect(call?.[1]?.temporaryReferences).toBe(temporaryReferences);
    expect(call?.[1]?.startTime).toBeTypeOf("number");
    yield* response.release;
  }),
);
