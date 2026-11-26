import { Effect, Predicate } from "effect";
import { HttpServerRequest } from "effect/http";

export const request = (id: string, init?: RequestInit): Request => {
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", id);
  return new Request("https://example.test/probe", { ...init, headers });
};

export const platformRequest = (id: string): HttpServerRequest.HttpServerRequest =>
  HttpServerRequest.fromWeb(request(id));

export const streamedBody = (response: Response): ReadableStream<Uint8Array> => {
  const { body } = response;
  if (Predicate.isNullish(body)) {
    // oxlint-disable-next-line rules/require-tagged-error -- A null Fetch body violates the native test fixture contract.
    throw new TypeError("Expected a streaming response body.");
  }
  return body;
};

export const cancelBody = (response: Response): Effect.Effect<void> =>
  Effect.promise(async () => streamedBody(response).cancel());
