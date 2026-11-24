import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { FlightPayload } from "../rsc/flight.ts";

export type RequestOutcome = Readonly<{
  formState: FlightPayload["formState"];
  serverFnResult: FlightPayload["serverFnResult"];
  status: 200;
  temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
}>;
