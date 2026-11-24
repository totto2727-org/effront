import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { FlightPayload } from "#core/rsc/flight.ts";

export const responseOk = 200;

export type RequestOutcome = Readonly<{
  formState: FlightPayload["formState"];
  serverFnResult: FlightPayload["serverFnResult"];
  status: typeof responseOk;
  temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
}>;
