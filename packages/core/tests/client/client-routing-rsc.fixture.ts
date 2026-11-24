import { vi } from "vitest";

import type { FlightPayload } from "#core/rsc/flight.ts";

// oxlint-disable-next-line unicorn/no-null -- These are empty Flight payload slots on the browser wire.
const absentFlightValue = null;
const payload = (): FlightPayload => ({
  formState: absentFlightValue,
  routeTree: { child: absentFlightValue, content: absentFlightValue, id: "root" },
  serverFnResult: absentFlightValue,
});

const observeLaterChunk = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> => {
  try {
    await reader.read();
  } catch {
    // The routing tests observe cancellation at the Flight request and response boundary.
  }
};

const loadRouteTree = async (stream: ReadableStream<Uint8Array>): Promise<FlightPayload> => {
  const reader = stream.getReader();
  await reader.read();
  // oxlint-disable-next-line typescript/no-floating-promises -- The fake decoder leaves the transport open until the fixture completes or cancels it.
  observeLaterChunk(reader);
  return payload();
};

vi.mock("@vitejs/plugin-rsc/browser", () => ({
  createFromReadableStream: vi.fn<typeof loadRouteTree>(loadRouteTree),
}));
