import { afterEach, expect, it, vi } from "@effect/vitest";
import { Suspense } from "react";

import type { FlightPayload } from "../rsc/flight";

let payload: FlightPayload;

vi.doMock("@vitejs/plugin-rsc/ssr", () => ({
  createFromReadableStream: () => Promise.resolve(payload),
  getClientEntryUrl: () => "/client.js",
}));

const { renderHtml } = await import("./ssr");

afterEach(() => vi.restoreAllMocks());

const flightStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("0:{}\n"));
      controller.close();
    },
  });

it("reports a recoverable React SSR error even when HTML completes normally", async () => {
  const failure = new Error("recoverable SSR failure");
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const observed = vi.fn();
  function BrokenContent(): never {
    throw failure;
  }
  payload = {
    formState: null,
    routeTree: {
      child: null,
      id: "root",
      content: (
        <html lang="en">
          <body>
            <Suspense fallback={<p>Recoverable fallback</p>}>
              <BrokenContent />
            </Suspense>
          </body>
        </html>
      ),
    },
    serverFnResult: null,
  };

  const stream = await renderHtml(flightStream(), {
    formState: null,
    onRenderError: observed,
    signal: new AbortController().signal,
  });
  const html = await new Response(stream).text();

  expect(html).toContain("Recoverable fallback");
  expect(observed).toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith(failure);
});

it("does not notify the observer for successful HTML rendering", async () => {
  const observed = vi.fn();
  payload = {
    formState: null,
    routeTree: {
      child: null,
      id: "root",
      content: (
        <html lang="en">
          <body>Successful render</body>
        </html>
      ),
    },
    serverFnResult: null,
  };

  const stream = await renderHtml(flightStream(), {
    formState: null,
    onRenderError: observed,
    signal: new AbortController().signal,
  });

  expect(await new Response(stream).text()).toContain("Successful render");
  expect(observed).not.toHaveBeenCalled();
});
