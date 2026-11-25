import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { FlightPayload } from "#core/rsc/flight.ts";

export const responseOk = 200;

export type RequestOutcome = Readonly<{
  formState: FlightPayload["formState"];
  serverFnResult: FlightPayload["serverFnResult"];
  status: typeof responseOk;
  temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
}>;

// oxlint-disable-next-line unicorn/no-null -- Initial Flight uses null for absent form state and Server Function results.
const absentFlightState = null;

export const initialPageOutcome: RequestOutcome = {
  formState: absentFlightState,
  serverFnResult: absentFlightState,
  status: responseOk,
};
