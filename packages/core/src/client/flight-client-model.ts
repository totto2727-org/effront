import { Data, Schema } from "effect";
import type { Effect } from "effect";
import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/browser";

import type { FlightPayload, ServerFnResult } from "#core/rsc/flight.ts";

// oxlint-disable-next-line unicorn/throw-new-error -- Effect's schema error builder supplies the constructor.
export class FlightLoadError extends Schema.TaggedError<FlightLoadError>()("FlightLoadError", {
  cause: Schema.Defect(),
  reason: Schema.Literals(["RequestFailed", "UnexpectedResponse", "DecodeFailed"]),
}) {}

type Destination = Readonly<{ destination: URL }>;
type Action = Destination &
  Readonly<{
    body: BodyInit;
    id: string;
    temporaryReferences: ReturnType<typeof createTemporaryReferenceSet>;
  }>;

export type FlightRequest = Data.TaggedEnum<{
  Navigation: Destination;
  Query: Action;
  ServerFunction: Action;
}>;

export const flightRequests = Data.taggedEnum<FlightRequest>();

export type DecodedFlight = Readonly<{
  completed: Effect.Effect<void, FlightLoadError>;
  payload: FlightPayload;
}>;

type ResponseRelease = Readonly<{ release: Effect.Effect<void> }>;

export type BrowserFlightResource = Data.TaggedEnum<{
  Document: ResponseRelease;
  Flight: DecodedFlight & ResponseRelease & Readonly<{ resolvedUrl: URL }>;
  Query: ResponseRelease &
    Readonly<{
      completed: Effect.Effect<void, FlightLoadError>;
      payload: ServerFnResult;
    }>;
}>;

export const flightResources = Data.taggedEnum<BrowserFlightResource>();

export const loadFailure = (message: string, reason: FlightLoadError["reason"]): FlightLoadError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Keep the native Error cause and message exposed by FlightLoadError.
  new FlightLoadError({ cause: new Error(message), reason });

export const impossibleResponse = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Keep the native TypeError used for an inconsistent loader response.
  new TypeError(message);
